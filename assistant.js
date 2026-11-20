const assistantView = document.querySelector(".assistant-view");
const assistantForm = document.querySelector(".assistant-form");
const questionInput = assistantForm.elements.question;
const aiToggle = assistantForm.elements.ai;
const sendButton = assistantForm.querySelector(".assistant-send");
const assistantStatus = assistantForm.querySelector("[role=status]");
const conversation = assistantView.querySelector(".assistant-log");
let previousAnswer = null;
let pendingClarification = null;

let aiAvailable = false;
async function refreshAssistantMode() {
  if (!/^https?:$/.test(location.protocol) || !navigator.onLine || aiAvailable) return;
  try {
    const response = await fetch("./api/assistant", {cache: "no-store", signal: AbortSignal.timeout(3000)});
    aiAvailable = response.ok && (await response.json()).enabled === true;
    aiToggle.closest("label").hidden = !aiAvailable;
  } catch {
    // The local catalogue also works offline.
  }
}

async function selectAnswers(question) {
  let status = "";
  if (aiAvailable && aiToggle.checked) {
    try {
      if (!navigator.onLine) throw new Error("Offline");
      const response = await fetch("./api/assistant", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({question, previous: previousAnswer}),
        signal: AbortSignal.timeout(11000)
      });
      if (!response.ok) throw new Error("Assistant unavailable");
      const answers = guideSearch.parseAiAnswers(services, (await response.json()).answers);
      if (answers.length) return {answers, status};
    } catch {
      status = "Показано відповідь із вбудованого гіда.";
    }
  }
  return {answers: guideSearch.localAnswers(services, question, previousAnswer), status};
}

function choicesFor(answers) {
  return '<div class="assistant-clarifications">' + answers.map(({route, section}) => {
    const service = services.find(item => item.id === route);
    const title = service.sections.find(item => item.id === section)?.title ?? service.title;
    return '<button class="assistant-choice" type="button" data-clarify-route="' + route +
      '" data-clarify-section="' + (section ?? "") + '">' + title + icon("chevron") + '</button>';
  }).join("") + '</div>';
}

function showAssistantAnswer(answers, question) {
  const message = document.createElement("article");
  message.className = "assistant-message assistant-answer";
  conversation.append(message);
  previousAnswer = answers.length === 1 ? answers[0] : null;
  if (!answers.length) {
    message.innerHTML = '<p>У гіді немає підтвердженої відповіді на це запитання. Уточніть послугу або зверніться на обласну ветеранську лінію.</p>' +
      actionFor([contacts[0].dial, contacts[0].phone], true);
    return;
  }
  if (answers.length > 1) {
    message.innerHTML = '<h2>Що саме вас цікавить?</h2>' + choicesFor(answers);
    pendingClarification = {question, message};
    return;
  }

  const {route, section: id} = answers[0];
  const service = services.find(item => item.id === route);
  const section = service.sections.find(item => item.id === id);
  const local = route === "escort" && guideSearch.findContacts(localContacts, question)[0];
  const paragraphs = local ? [local.description, local.details].filter(Boolean) : section?.paragraphs ?? [service.steps[0]];
  const followUp = !local && !section;
  message.innerHTML = '<h2>' + (local?.title ?? section?.title ?? service.title) + '</h2>' +
    paragraphs.map(text => '<p>' + text + '</p>').join("") +
    (followUp ? '<p>Уточніть, яка саме процедура або умова вас цікавить.</p>' +
      choicesFor(service.sections.map(item => ({route, section: item.id}))) : '') +
    (local ? actionFor([local.dial, local.phone]) : "") + actionFor(section?.action ?? service.action) +
    '<button type="button" class="assistant-route" data-detail="' + route + '" data-section="' +
    (section?.id ?? "") + '">Повний маршрут' + icon("chevron") + '</button>' + saveRouteButton(route) +
    sourcesFor([...new Set([...service.source, preparation[route]?.source, local?.source].filter(Boolean))]);
  if (followUp) pendingClarification = {question, message};
}

assistantForm.addEventListener("submit", async event => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question || sendButton.disabled) return;

  pendingClarification?.message.querySelectorAll("[data-clarify-route]").forEach(button => { button.disabled = true; });
  pendingClarification = null;
  const message = document.createElement("p");
  message.className = "assistant-message assistant-question";
  message.textContent = question;
  conversation.append(message);
  questionInput.value = "";
  sendButton.disabled = true;
  assistantStatus.textContent = "Шукаю відповідь…";
  try {
    const {answers, status} = await selectAnswers(question);
    showAssistantAnswer(answers, question);
    assistantStatus.textContent = status;
  } finally {
    sendButton.disabled = false;
  }
  conversation.lastElementChild?.scrollIntoView({block: "start"});
});

conversation.addEventListener("click", event => {
  const choice = event.target.closest("[data-clarify-route]");
  if (!choice || !pendingClarification?.message.contains(choice) || sendButton.disabled) return;
  const {question, message} = pendingClarification;
  const {clarifyRoute: route, clarifySection: section} = choice.dataset;
  const service = services.find(item => item.id === route);
  if (!service) return;
  const matches = section ? [] : guideSearch.answerSections(service, question);
  pendingClarification = null;
  message.remove();
  showAssistantAnswer(matches.length ? matches.map(({id}) => ({route, section: id})) : [{route, section: section || null}], question);
  assistantStatus.textContent = "Запит уточнено.";
  conversation.lastElementChild?.scrollIntoView({block: "start"});
});

assistantView.querySelector(".assistant-prompts").addEventListener("click", event => {
  const suggestion = event.target.closest("[data-question]");
  if (!suggestion || sendButton.disabled) return;
  questionInput.value = suggestion.dataset.question;
  assistantForm.requestSubmit();
});
document.addEventListener("click", event => {
  if (event.target.closest("[data-tab=assistant]")) void refreshAssistantMode();
});
