const guideSearch = (() => {
  function tokens(text) {
    return text.toLocaleLowerCase("uk").replace(/[’ʼ‘']/g, "").match(/[\p{L}\p{N}]+/gu) ?? [];
  }

  function normalized(text) {
    return tokens(text).join(" ");
  }

  const genericWords = new Set([
    "ветеран", "ветерана", "ветеранам", "ветеранів", "допомога", "допомогу", "помощь",
    "куди", "куда", "звернутися", "обратиться", "порадьте", "підкажіть", "потрапити", "пройти",
    "оформити", "оформить", "подати", "подать", "отримати", "получить", "для", "які", "який",
    "яка", "що", "як", "как", "что", "можна", "чи", "потрібні", "потрібна", "документи",
    "заяву", "заява", "мені", "меня", "після", "безоплатно", "безкоштовно", "допомогти"
  ]);

  function queryWords(text) {
    return [...new Set(tokens(text))].filter(word => word.length >= 3 && !genericWords.has(word));
  }

  function similar(a, b) {
    return a === b || (a[0] === b[0] && Math.min(a.length, b.length) >= 5 && a.slice(0, 5) === b.slice(0, 5));
  }

  function keywordScore(query, keys) {
    const words = tokens(query);
    const phrase = " " + words.join(" ") + " ";
    return Math.max(0, ...keys.split("|").map(key => {
      const terms = tokens(key);
      if (!terms.length) return 0;
      if (phrase.includes(" " + terms.join(" ") + " ")) return terms.length * 5;
      if (terms.length === 1 && words.some(word => similar(word, terms[0]))) return 2;
      return 0;
    }));
  }

  function findServices(services, query) {
    if (!query.trim()) return services;
    const words = queryWords(query);
    if (!words.length) {
      const prefixes = tokens(query).filter(word => word.length < 3 && !genericWords.has(word));
      return services.filter(service => prefixes.some(prefix =>
        tokens(service.title + " " + service.keys).some(term => term.startsWith(prefix))));
    }
    return services.map(service => {
      const title = tokens(service.title);
      const keywords = tokens(service.keys);
      const text = tokens([service.desc, ...service.steps, ...service.sections.flatMap(section => section.paragraphs)].join(" "));
      const sectionScore = Math.max(0, ...service.sections.map(section => keywordScore(query, section.keys)));
      const score = words.reduce((sum, word) => {
        if (title.includes(word)) return sum + 14;
        if (keywords.includes(word)) return sum + 11;
        if (title.some(term => similar(word, term))) return sum + 8;
        if (keywords.some(term => similar(word, term))) return sum + 6;
        return sum + (text.includes(word) ? 1 : 0);
      }, 0);
      return {service, score: score + sectionScore};
    }).filter(({score}) => score > 0).sort((a, b) => b.score - a.score).map(({service}) => service);
  }

  function findSections(sections, query, allowPartial = false) {
    if (!query.trim()) return sections;
    const words = queryWords(query);
    const terms = words.length ? words : tokens(query);
    const matches = (token, term) => similar(token, term) || token.startsWith(term);
    return sections.map(section => {
      const title = tokens(section.title);
      const keywords = tokens(section.keys);
      const text = words.length ? tokens(section.paragraphs.join(" ")) : [];
      let score = keywordScore(query, section.keys);
      for (const term of terms) {
        if (title.some(token => matches(token, term))) score += 8;
        else if (keywords.some(token => matches(token, term))) score += 5;
        else if (text.some(token => matches(token, term))) score += 1;
        else if (!allowPartial) return {section, score: 0};
      }
      return {section, score};
    }).filter(({score}) => score > 0).sort((a, b) => b.score - a.score).map(({section}) => section);
  }

  const subjectRules = [
    [/зуб|стоматолог/iu, "medical"],
    [/(?:^|[^\p{L}])(?:ліки|ліків|ліками)(?!\p{L})|лікарськ\p{L}* засоб|рецепт|аптек|аптеці|медикамент|лекарств/u, "medical"],
    [/психолог|психотерап|психіатр|безсонн|не спиться|не сплю|не можу спати|не можу заснути|не могу спать|не могу уснуть|птср|кошмар|панічн/u, "psychology"],
    [/підтвердж\p{L}* полон|підтвердити полон|позбавлен\p{L}* особистої свободи/u, "pow-family"],
    [/безвісті|безвісти|зникл|зник |зникн|єрдр|впізна\p{L}* на (?:фото|відео)|портретн\p{L}* експертиз/u, "missing-family"],
    [/полон|плен/u, "pow-family"],
    [/загиб|полегл|погиб|годувальник|частина не (?:дає|видає|надає) акт|(?:доступу до|знайшли|евакуювали) тіла|смерт\p{L}* військов/u, "fallen-family"],
    [/(?:звільн\p{L}*.*інвалід|інвалід.*звільн\p{L}*|влк.*придатн\p{L}*.*інвалід)/u, "msek"],
    [/влк|\bввк\b|придатність|резерв\+/iu, "vlk"],
    [/мсек|екопфо|екпфо|\bопфо\b|експертно[їю] команд|експертна команда|повсякденн/u, "msek"],
    [/протез|гільз|гильз|реабілітац|реабилитац|допоміжн.{1,4} засіб|візок|колісн\p{L}*\s+кріс|кріс\p{L}*\s+колісн/u, "rehab"],
    [/комунал|жкп|жку|льгот|пільг|пенсі|пенси/u, "benefits"],
    [/житл|квартир|оренд|єосел|іпотек/u, "housing"],
    [/поран|ранени|контузі|контузи|госпітал/u, "injury"],
    [/ваучер|грант|власн\p{L}* справ|сво\p{L}* бизнес|працевлашт|ваканс|перекваліф/u, "work"],
    [/супровід|супровод|фахівц|фахівець|не знаю з чого почати|потрібна людина.*(?:документ|заяв)|нужен человек.*(?:документ|заяв)/u, "escort"],
    [/убд|оівв|посвідчен|удостовер|учасник[а-яіїє]* бойових дій/u, "status"],
    [/адвокат|юрист|\bбпд\b|правнич|сзч|самовільн\p{L}* залишен|самовольн\p{L}* оставлен/u, "legal"]
  ];

  const meaningPrompt = /^(?:що (?:це )?таке|що означає|що значить|что (?:это )?такое|что означает|что значит) /u;

  function requiresUnavailableAnswer(question) {
    const phrase = normalized(question);
    return /^(?:будь ласка |пожалуйста )?(?:гарантуй|гарантируй) /u.test(phrase) ||
      /(?:^| )(?:вигадай|выдумай|придумай) (?:нові |новые )?(?:сум|строк|термін)/u.test(phrase) ||
      /(?:^| )(?:чи я точно|точно чи я|точно ли я) (?:отримаю|одержу|получу)(?: |$)/u.test(phrase) ||
      /(?:^| )(?:мені|мне) точно (?:схвалять|погодять|одобрят|дадуть|дадут)(?: |$)/u.test(phrase) ||
      /(?:^| )(?:назви|назови) (?:точну |точную )?дату коли .*повернеться|(?:^| )коли (?:вони |мені )+подзвонять(?: |$)/u.test(phrase);
  }

  // A loss verb needs an object. On its own it is not evidence of either amputation or bereavement.
  function reportsLimbLoss(phrase) {
    if (/(?:^| )(?:після ампутації|после ампутации)(?: |$)/u.test(phrase)) return true;
    const words = phrase.split(" ");
    return words.some((word, i) => {
      if (!/^(?:ногу|ноги|ніг|ног|руку|руки|рук|кінцівку|конечность|стопу|кисть)$/u.test(word)) return false;
      const modifier = /^(?:ліву|левую|праву|правую|обидві|обе|частину|часть)$/u;
      const before = words.slice(0, modifier.test(words[i - 1]) ? i - 1 : i).join(" ");
      return /(?:^| )(?<!не )(?:потерял[аи]?|втратив|втратила|втратили|ампутували|ампутировали|відірвало|оторвало|залиши(?:вся|лася) без|остал(?:ся|ась) без|немає|нет)$/u.test(before);
    });
  }

  function matchTopics(services, question, lastTopic) {
    const plain = question.toLocaleLowerCase("uk");
    const phrase = normalized(plain);
    if (/(?:^| )(?:дії|дія|дію|дия)(?: |$)/u.test(phrase) &&
        /(?:зник\p{L}*|пропал\p{L}*)\s+(?:е\s+)?(?:посвідчен|удостовер|документ ветерана)/u.test(phrase) &&
        services.some(service => service.id === "status")) return ["status"];
    const explicit = subjectRules.filter(([pattern]) => pattern.test(plain) || pattern.test(phrase))
      .map(([, id]) => id).filter(id => services.some(service => service.id === id));
    if (explicit.includes("vlk") && explicit.includes("msek")) {
      return explicit[0] === "msek" || /(?:екопфо|екпфо).*відпуст/u.test(plain) ? ["msek"] : ["vlk", "msek"];
    }
    if (explicit.includes("rehab") && explicit.includes("benefits") && /^(протези?|реабілітація)\s+(і|й|та|або|и)\s+(пільг|виплат|льгот)/iu.test(plain.trim())) {
      return ["rehab", "benefits"];
    }
    if (explicit.includes("housing") && explicit.includes("missing-family") && /оренд|житл/u.test(plain)) return ["housing"];
    if (explicit.includes("work") && /бізнес|грант|ваучер/u.test(plain)) return ["work"];
    if (explicit.includes("vlk") && explicit.includes("injury") && /(?:скільки|виплат|грошове забезпечення|втрата працездатності)/u.test(plain)) return ["injury"];
    if (explicit.length) return [explicit[0]];
    if (reportsLimbLoss(phrase) && services.some(service => service.id === "rehab")) return ["rehab"];
    if (lastTopic && !meaningPrompt.test(phrase.replace(/^(?:а|і|и) /u, "")) &&
        /^(?:а\s+|і\s+)?(?:де|где|куди|куда|як|как|які|какие|скільки|коли|чи|що|что|а|і|и)(?=\s|[?!,.]|$)/iu.test(question.trim())) {
      return [lastTopic];
    }
    const match = findServices(services, question).find(service => {
      const routeWords = tokens(service.title + " " + service.keys);
      return queryWords(question).some(word => routeWords.some(term => similar(word, term)));
    });
    return match ? [match.id] : [];
  }

  function answerSections(service, question, previousSection) {
    const scored = service.sections.filter(section => !section.definition)
      .map(section => ({section, score: keywordScore(question, section.keys)}))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const appeal = service.sections.find(section => section.id === "appeal");
    if (appeal && /оскарж|скарг|незгод|не згод/u.test(question.toLocaleLowerCase("uk"))) return [appeal];
    if (best && best.score > 0) {
      const tied = scored.filter(({score}) => score === best.score).map(({section}) => section);
      return tied.length === 1 ? [best.section] : tied;
    }
    if (service.id === "rehab" && reportsLimbLoss(normalized(question))) {
      const start = service.sections.find(section => section.id === "after-amputation");
      if (start) return [start];
    }
    if (previousSection && /^(?:а\s+)?(?:які документи|що підготувати|куди подати|куди звернутися|де подати)/iu.test(question.trim())) {
      const previous = service.sections.find(section => section.id === previousSection);
      if (previous) return [previous];
    }
    return [];
  }

  function findContacts(contacts, query) {
    const words = queryWords(query);
    if (!words.length) return query.trim() ? [] : contacts;
    return contacts.filter(contact => {
      const localNames = tokens(contact.keys);
      return words.some(word => localNames.some(name => name.startsWith(word) || similar(word, name)));
    });
  }

  function directCatalogAnswers(services, question, previous) {
    const phrase = normalized(question);
    if (!phrase) return [];
    const continued = phrase.replace(/^(?:(?:а|і|ну|можна|можно|можеш|можешь|можете|будь ласка|пожалуйста) )+/u, "");
    const request = continued.replace(/^(?:розкажи|розкажіть|розповісти|поясни|поясніть|пояснити|расскажи|расскажите|рассказать|объясни|объясните|объяснить) (?:(?:мені|мне) )?/u, "")
      .replace(/^(?:простими словами|простыми словами) /u, "");
    const details = /^(?:трохи |чуть )?(?:детальніше|докладніше|подробнее|поподробнее)(?: (?:про це|про це все|об этом))?$/u;
    if (previous && details.test(request)) {
      const service = services.find(item => item.id === previous.route);
      if (service) {
        const definition = service.sections.find(section => section.id === previous.section)?.definition;
        if (definition || previous.section) return [{route: service.id, section: definition?.nextSection ?? null}];
        return service.sections.filter(section => !section.definition).slice(0, 3)
          .map(section => ({route: service.id, section: section.id}));
      }
    }

    const term = request
      .replace(meaningPrompt, "")
      .replace(/^(?:що (?:є|входить) (?:в|у) розділі|что (?:есть|находится) в разделе) /u, "")
      .replace(/^(?:про|о) /u, "")
      .replace(/ (?:це що|это что)$/u, "")
      .replace(/^(?:взагалі|вообще) | (?:взагалі|вообще)$/gu, "");
    const exact = services.flatMap(service => service.sections.filter(section =>
      section.definition ? section.keys.split("|").includes(term) : normalized(section.title) === phrase
    ).map(section => ({route: service.id, section: section.id})));
    if (exact.length) return exact.length === 1 ? exact : [];
    const route = services.find(service => normalized(service.title) === term);
    if (route) return [{route: route.id, section: null}];
    if (previous && /^(?:а )?(?:в|у) \p{L}+(?: \p{L}+)?$/u.test(phrase)) {
      const service = services.find(item => item.id === previous.route);
      const sections = service?.sections.filter(section => !section.definition && keywordScore(phrase, section.keys) >= 5) ?? [];
      if (sections.length === 1) return [{route: service.id, section: sections[0].id}];
    }
    return [];
  }

  function questionParts(question) {
    const parts = question.split(/(?<=\?)\s+|(?:[.!;]|(?:,?\s+(?:і|й|та|и)|,\s+а))\s+(?=(?:а\s+)?(?:що|что|хто|кто|як|как|де|где|куди|куда|коли|когда|які|какие|яка|какая|скільки|сколько|чи|можна|можно)\s)/iu)
      .map(part => part.trim()).filter(Boolean);
    if (parts.length > 1 && !parts[0].endsWith("?") &&
        !/^(?:(?:а|і|и|ну) )?(?:що|что|хто|кто|як|как|де|где|куди|куда|коли|когда|які|какие|яка|какая|скільки|сколько|чи|можна|можно|розкажи|расскажи|поясни|объясни)(?: |$)/u.test(normalized(parts[0]))) {
      return parts.length > 2 ? [parts[0] + " " + parts[1], ...parts.slice(2)] : [question];
    }
    return parts;
  }

  function localAnswers(services, question, previous) {
    if (requiresUnavailableAnswer(question)) return [];
    const direct = directCatalogAnswers(services, question, previous);
    if (direct.length) return direct;
    const routes = matchTopics(services, question, previous?.route);
    if (routes.length !== 1) return routes.map(route => ({route, section: null}));
    const route = routes[0];
    const service = services.find(item => item.id === route);
    if (!service) return [];
    const sections = answerSections(service, question, route === previous?.route ? previous.section : null);
    return sections.length ? sections.map(({id}) => ({route, section: id})) : [{route, section: null}];
  }

  function localCatalogReply(services, question, previous) {
    const parts = questionParts(question);
    const matches = parts.length > 1 && parts.length <= 3 ? parts.map(part => localAnswers(services, part, previous)) : [];
    const grounded = matches.filter(choices => choices.length === 1 && choices[0].section);
    if (grounded.length && matches.every(choices => !choices.length || grounded.includes(choices))) {
      const unique = new Map(grounded.flat().map(item => [item.route + ":" + item.section, item]));
      return {answers: [...unique.values()], mode: grounded.length === matches.length ? "answer" : "partial"};
    }
    const answers = localAnswers(services, question, previous).slice(0, 3);
    return {answers, mode: answers.length > 1 ? "clarify" : "answer"};
  }

  function parseAiAnswers(services, value) {
    if (!Array.isArray(value) || value.length > 3) throw new Error("Invalid assistant response");
    return value.map(item => {
      const {route, section} = item ?? {};
      const service = services.find(item => item.id === route);
      const material = service?.sections.find(item => item.id === section);
      if (!service || (section !== null && !material)) {
        throw new Error("Unknown catalogue entry");
      }
      const {paragraphs} = item;
      if (paragraphs === undefined) return {route, section};
      if (!material || !Array.isArray(paragraphs) || !paragraphs.length || new Set(paragraphs).size !== paragraphs.length ||
          !paragraphs.every(id => Number.isInteger(id) && id >= 1 && id <= material.paragraphs.length)) {
        throw new Error("Unknown catalogue paragraph");
      }
      return {route, section, paragraphs};
    });
  }

  const conversationReplies = {
    greeting: "Вітаю! Чим можу допомогти?",
    available: "Так, я на зв’язку. Чим можу допомогти?",
    wellbeing: "Дякую, що питаєте. У мене все гаразд, я на зв’язку. А як ви?",
    thanks: "Будь ласка! Якщо виникне ще запитання, звертайтеся.",
    about: "Я Характерник, помічник ветеранського гіда. Можу пояснити ветеранський термін або допомогти знайти послугу в гіді.",
    unclear: "Можете уточнити, що маєте на увазі?",
    offTopic: "Можу допомогти з ветеранськими послугами, документами й контактами з гіда. Що з цього вас цікавить?",
  };

  function parseCatalogReply(services, value) {
    const answers = parseAiAnswers(services, value?.answers);
    const mode = value.mode ?? (answers.length > 1 ? "clarify" : "answer");
    if (!["answer", "clarify", "partial"].includes(mode) || (mode === "clarify" && answers.length < 2) ||
        (mode === "partial" && !answers.length)) throw new Error("Invalid assistant response");
    const conversation = value.conversation;
    if (value.text !== undefined) {
      if (mode !== "answer" || answers.length || conversation !== undefined || typeof value.text !== "string" ||
          !value.text.trim() || value.text.trim().length > 1500) throw new Error("Invalid generated reply");
      return {answers, mode, text: value.text.trim()};
    }
    if (conversation === undefined) return {answers, mode};
    if (mode !== "answer" || answers.length || typeof conversation !== "string" ||
        !Object.hasOwn(conversationReplies, conversation)) throw new Error("Invalid conversational reply");
    return {answers, mode, conversation};
  }

  return {findServices, findSections, matchTopics, answerSections, findContacts, directCatalogAnswers, requiresUnavailableAnswer,
    localAnswers, questionParts, localCatalogReply, parseAiAnswers, parseCatalogReply, normalized, conversationReplies};
})();

if (typeof module !== "undefined") module.exports = guideSearch;
