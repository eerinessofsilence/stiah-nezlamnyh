const {sources, services, preparation, groups, featured, checkedOn, contacts, localContacts} = catalog;

const homeSearch = document.querySelector("#home-search");
const catalogSearch = document.querySelector("#catalog-search");
const dialog = document.querySelector("#detail-dialog");
const dialogContent = document.querySelector("#dialog-content");
const navigation = document.querySelector(".bottom-nav");
const assistantDockForm = document.querySelector(".assistant-form");
const installButton = document.querySelector("#install-button");
const savedList = document.querySelector("#saved-services");
const savedEmpty = document.querySelector("#saved-empty");
const routeStorageKey = "nezlamnyi-route-progress-v1";
const serviceIds = new Set(services.map(({id}) => id));
const checklistIds = new Set(Object.entries(preparation).flatMap(([id, list]) => list.items.map(([key]) => id + ":" + key)));
let installPrompt = null;
let routeProgress = readRouteProgress() ?? {saved: [], checked: []};
let storageUnavailable = false;

function validIds(ids, known) {
  return Array.isArray(ids) ? [...new Set(ids.filter(id => known.has(id)))] : [];
}

function readRouteProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(routeStorageKey));
    return {saved: validIds(data?.saved, serviceIds), checked: validIds(data?.checked, checklistIds)};
  } catch {
    return null;
  }
}

function persistRouteProgress() {
  try {
    localStorage.setItem(routeStorageKey, JSON.stringify(routeProgress));
    storageUnavailable = false;
  } catch {
    storageUnavailable = true;
    const container = dialog.open ? dialogContent : document.querySelector(".assistant-form");
    const notice = container.querySelector(".storage-note") || document.createElement("p");
    notice.className = "storage-note";
    notice.setAttribute("role", "status");
    notice.textContent = "Зміни доступні до закриття цієї сторінки.";
    container.append(notice);
  }
}

function updateProgress(key, id, checked) {
  const known = key === "saved" ? serviceIds : checklistIds;
  if (!known.has(id)) return;

  function apply() {
    if (!storageUnavailable) routeProgress = readRouteProgress() ?? routeProgress;
    const items = routeProgress[key];
    const enabled = checked ?? !items.includes(id);
    routeProgress[key] = enabled ? [...new Set([...items, id])] : items.filter(item => item !== id);
    persistRouteProgress();
    updateSaveButtons();
    updateChecklist();
  }

  if (navigator.locks) {
    void navigator.locks.request(routeStorageKey, apply);
  } else {
    apply();
  }
}

function icon(name, className = "icon") {
  const symbol = name === "injury" ? "medical" : name === "psychology" ? "fallen-family" : name;
  return '<svg class="' + className + '" aria-hidden="true"><use href="#icon-' + symbol + '"/></svg>';
}
function card(service) {
  return '<button class="service-card" type="button" data-detail="' + service.id + '"><span class="service-icon">' + icon(service.id) + '</span>' + icon("chevron", "icon card-chevron") + '<strong>' + service.title + '</strong></button>';
}
function row(service, description = service.desc, section = null) {
  return '<button class="service-row" type="button" data-detail="' + service.id + '"' +
    (section ? ' data-section="' + section + '"' : '') + '><span class="service-icon">' + icon(service.id) + '</span><span class="service-row-copy"><strong>' + service.title + '</strong><small>' + description + '</small></span>' + icon("chevron", "icon row-chevron") + "</button>";
}
function renderSaved() {
  const saved = routeProgress.saved.map(id => services.find(service => service.id === id)).reverse();
  savedList.innerHTML = saved.map(service => {
    const summary = guideSearch.routeProgressSummary(service.id, preparation, routeProgress.checked);
    const part = service.sections.find(section => section.id === summary.section);
    const next = summary.next ?? part?.action?.[1] ?? service.steps[0];
    return row(service, [part?.title, summary.completed + " із " + summary.total + " підготовлено.", "Далі: " + next]
      .filter(Boolean).join(" "), summary.section);
  }).join("");
  savedList.hidden = saved.length === 0;
  savedEmpty.hidden = saved.length > 0;
}

function saveRouteButton(id) {
  const saved = routeProgress.saved.includes(id);
  return '<button class="save-route" type="button" data-save-route="' + id +
    '" aria-label="Зберегти маршрут" aria-pressed="' + saved + '">' + icon("bookmark") +
    '<span>' + (saved ? "Збережено" : "Зберегти маршрут") + '</span></button>';
}

function updateSaveButtons() {
  document.querySelectorAll("[data-save-route]").forEach(button => {
    const saved = routeProgress.saved.includes(button.dataset.saveRoute);
    button.setAttribute("aria-pressed", String(saved));
    button.querySelector("span").textContent = saved ? "Збережено" : "Зберегти маршрут";
  });
  renderSaved();
}
function updateChecklist() {
  for (const list of dialog.querySelectorAll(".route-checklist")) {
    const boxes = [...list.querySelectorAll("[data-check-item]")];
    for (const box of boxes) box.checked = routeProgress.checked.includes(box.dataset.checkItem);
    list.querySelector(".checklist-count").textContent = boxes.filter(box => box.checked).length + " із " + boxes.length;
  }
}

window.addEventListener("storage", event => {
  if (event.storageArea !== localStorage || (event.key !== routeStorageKey && event.key !== null) || storageUnavailable) return;
  routeProgress = readRouteProgress() ?? routeProgress;
  updateSaveButtons();
  updateChecklist();
});
function render() {
  const searching = Boolean(catalogSearch.value.trim());
  const home = searching ? guideSearch.findServices(services, homeSearch.value).slice(0, 6)
    : featured.map(id => services.find(service => service.id === id));
  const results = guideSearch.findServices(services, catalogSearch.value);
  document.querySelector("#home-services").innerHTML = home.map(card).join("");
  document.querySelector("#home-situations").hidden = searching;
  document.querySelector("#home-start").hidden = searching;
  const all = document.querySelector("#all-services");
  all.textContent = searching && home.length ? "Усі результати" : "Усі послуги";
  all.toggleAttribute("data-reset-search", !home.length);
  document.querySelector("#home-empty").hidden = !!home.length;
  document.querySelector("#catalog-empty").hidden = !!results.length;
  const list = items => '<div class="service-list">' + items.map(service => row(service)).join("") + '</div>';
  document.querySelector("#catalog-services").innerHTML = searching ? (results.length ? list(results) : "") :
    groups.map(group => '<section><h2 class="catalog-group-title">' + group.title + '</h2>' +
      list(services.filter(service => service.group === group.id)) + '</section>').join("");
  for (const input of [homeSearch, catalogSearch]) {
    input.nextElementSibling.hidden = !input.value;
  }
}

function contactCard(contact, featured = false) {
  return '<article class="contact-card' + (featured ? ' contact-feature' : '') + '"><h2>' + contact.title + '</h2><p>' +
    contact.description + '</p>' + (contact.details ? '<address>' + contact.details + '</address>' : '') +
    '<a class="button full-button ' + (featured ? 'button-accent' : 'button-outline') + '" href="' + contact.dial +
    '" aria-label="Зателефонувати: ' + contact.phone + '">' + icon("phone") + contact.phone + '</a>' +
    (contact.email ? '<a class="contact-email" href="mailto:' + contact.email + '">' + contact.email + '</a>' : '') +
    '<a class="inline-source" href="' + sources[contact.source][1] + '" target="_blank" rel="noopener noreferrer">Офіційне джерело ' +
    icon("external") + '</a></article>';
}

const communitySearch = document.querySelector("#community-search");
function renderLocalContacts() {
  const matches = communitySearch.value.trim() ? guideSearch.findContacts(localContacts, communitySearch.value) : localContacts.slice(0, 2);
  document.querySelector("#local-contacts").innerHTML = matches.map(contact => contactCard(contact)).join("");
  document.querySelector("#community-empty").hidden = !!matches.length;
}
communitySearch.addEventListener("input", renderLocalContacts);
document.querySelector("#regional-hotline").innerHTML = contactCard(contacts[0], true);
document.querySelector("#regional-contacts").innerHTML = contacts.slice(1).filter(contact => contact.source !== "hub")
  .map(contact => contactCard(contact)).join("");
document.querySelector("#specialist-search").href = sources.localSpecialist[1];
document.querySelector("#catalog-date").textContent = "Редакція каталогу від " + checkedOn;
renderLocalContacts();

function setTab(name, trigger) {
  const target = document.querySelector('[data-view="' + name + '"]');
  if (!target || !target.hidden) return;

  const moveFocus = !!trigger.closest("[data-view], dialog");
  document.querySelectorAll("[data-view]").forEach(function (view) {
    view.hidden = view !== target;
  });
  assistantDockForm.hidden = name !== "assistant";
  navigation.querySelectorAll("[data-tab]").forEach(function (button) {
    const active = button.dataset.tab === name;
    button.querySelector("use").setAttribute("href", "#icon-" + button.dataset.icon + (active ? "-filled" : ""));
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  window.scrollTo(0, 0);
  if (moveFocus) target.querySelector("h1").focus({preventScroll: true});
}
function linksFor(keys) {
  return keys.map(function (key) {
    const source = sources[key];
    return '<a href="' + source[1] + '" target="_blank" rel="noopener noreferrer"><span>' + source[0] + '<small class="source-checked">Посилання перевірено ' + source[2] + "</small></span>" + icon("external") + "</a>";
  }).join("");
}
function sourcesFor(keys) {
  return '<details class="guide-sources"><summary>Джерела й перевірка</summary><div class="dialog-source">' +
    linksFor(keys) + '</div></details>';
}
function checklistFor(id) {
  const checklist = preparation[id];
  if (!checklist) return "";
  const items = checklist.items.map(([key, label]) => {
    const item = id + ":" + key;
    const checked = routeProgress.checked.includes(item) ? " checked" : "";
    return '<label class="checklist-item"><input type="checkbox" data-check-item="' + item +
      '"' + checked + '><span>' + label + '</span></label>';
  }).join("");
  const count = checklist.items.filter(([key]) => routeProgress.checked.includes(id + ":" + key)).length;
  const title = "checklist-" + id.replaceAll(":", "-");
  return '<section class="route-checklist" aria-labelledby="' + title + '">' +
    '<div class="checklist-heading"><h3 id="' + title + '">Що підготувати</h3>' +
    '<span class="checklist-count" role="status">'  + count + ' із ' + checklist.items.length + '</span></div>' +
    '<p>' + checklist.note + '</p>' + items + '</section>';
}

function actionFor(action, primary = false) {
  if (!action) return "";
  const [destination, label] = action;
  const className = ' class="button full-button ' + (primary ? "button-dark" : "button-outline") + '"';
  if (destination === "contacts") return '<button type="button"' + className +
    ' data-tab="nearby">' + label + icon("arrow") + '</button>';
  const source = sources[destination];
  return '<a' + className + ' href="' + (source?.[1] ?? destination) + '"' +
    (source ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label +
    icon(source ? "external" : "phone") + '</a>';
}

function showDetails(id, sectionId) {
  const service = services.find(item => item.id === id);
  if (!service) return;
  const active = service.sections.find(section => section.id === sectionId);
  const checklist = preparation[id];
  const lists = Object.entries(preparation).filter(([key]) => key === id || key.startsWith(id + ":"));
  const references = [...new Set([...service.source, ...lists.map(([, list]) => list.source)])];
  function sectionCard(section, open = false) {
    const list = lists.find(([, list]) => list.section === section.id);
    return '<details class="route-situation"' + (open ? ' open' : '') + '><summary>' + section.title +
      '</summary><div>' + section.paragraphs.map(paragraph => '<p>' + paragraph + '</p>').join("") +
      actionFor(section.action) + (list ? checklistFor(list[0]) : '') + '</div></details>';
  }
  dialogContent.innerHTML =
    '<h2 id="dialog-title">' + service.title + '</h2><p class="dialog-intro">' + service.desc + '</p>' +
    (active ? sectionCard(active, true) : '') + actionFor(service.action, true) + saveRouteButton(id) +
    '<div class="route-start"><h3>З чого почати</h3><ol class="dialog-steps">' +
    service.steps.map(step => '<li>' + step + '</li>').join("") + '</ol></div>' +
    (checklist && !checklist.section ? checklistFor(id) : '') +
    '<h3 class="dialog-section-title">' + (active ? 'Інші питання за темою' : 'Оберіть свою ситуацію') + '</h3>' +
    service.sections.filter(section => section !== active).map(section => sectionCard(section)).join("") +
    '<p class="source-checked">Редакція від ' + checkedOn + '</p>' + sourcesFor(references) +
    '<h3 class="dialog-section-title">Пов’язані маршрути</h3><div class="service-list">' +
    service.related.map(related => row(services.find(item => item.id === related))).join("") + '</div>';
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector(".dialog-close").focus({preventScroll: true});
}
document.addEventListener("click", function (event) {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    event.preventDefault();
    if (dialog.open) dialog.close();
    if (tab.hasAttribute("data-reset-search")) updateSearch("");
    setTab(tab.dataset.tab, tab);
  }
  const detail = event.target.closest("[data-detail]");
  if (detail) showDetails(detail.dataset.detail, detail.dataset.section);
  const save = event.target.closest("[data-save-route]");
  if (save) updateProgress("saved", save.dataset.saveRoute);
  if (event.target.closest(".dialog-close")) dialog.close();
});
dialog.addEventListener("change", event => {
  const item = event.target.dataset.checkItem;
  if (!item) return;
  updateProgress("checked", item, event.target.checked);
});
function updateSearch(query) {
  homeSearch.value = catalogSearch.value = query;
  render();
}
for (const input of [homeSearch, catalogSearch]) {
  input.addEventListener("input", function () { updateSearch(input.value); });
  input.nextElementSibling.addEventListener("click", function () {
    updateSearch("");
    input.focus();
  });
}
dialog.addEventListener("click", function (event) {
  if (event.target !== dialog) return;
  const {left, right, top, bottom} = dialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
});
document.addEventListener("keydown", function (event) {
  if (event.key === "/" && !dialog.open && !event.target.matches("input, textarea")) {
    const search = document.querySelector(".view:not([hidden]) input[type=search]");
    if (search) { event.preventDefault(); search.focus(); }
  }
});
function updateOnline() { document.querySelector("#offline-note").hidden = navigator.onLine; }
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
updateOnline();
render();
renderSaved();
window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", function () {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  installButton.hidden = true;
  prompt.prompt();
});
window.addEventListener("appinstalled", function () {
  installPrompt = null;
  installButton.hidden = true;
});
if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); });
