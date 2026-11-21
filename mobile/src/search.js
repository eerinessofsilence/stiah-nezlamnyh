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

  const subjectRules = [
    [/зуб|стоматолог/iu, "medical"],
    [/психолог|психотерап|психіатр|безсонн|не спиться|не сплю|птср|кошмар|панічн/u, "psychology"],
    [/безвісті|безвісти|зникл|зник |зникн|полон|плен|єрдр/u, "missing-family"],
    [/загиб|полегл|погиб|годувальник/u, "fallen-family"],
    [/влк|\bввк\b|придатність|резерв\+/iu, "vlk"],
    [/мсек|екопфо|\bопфо\b|експертно[їю] команд|експертна команда|повсякденн/u, "msek"],
    [/протез|реабілітац|реабилитац|допоміжн.{1,4} засіб|візок|колісн\p{L}*\s+кріс|кріс\p{L}*\s+колісн/u, "rehab"],
    [/комунал|жкп|жку|льгот|пільг|пенсі|пенси/u, "benefits"],
    [/житл|квартир|оренд|єосел|іпотек/u, "housing"],
    [/поран|ранени|контузі|контузи|госпітал/u, "injury"],
    [/ваучер|грант|працевлашт|ваканс|перекваліф/u, "work"],
    [/супровід|супровод|фахівц|фахівець|не знаю з чого почати/u, "escort"],
    [/убд|оівв|посвідчен|удостовер|учасник[а-яіїє]* бойових дій/u, "status"],
    [/адвокат|юрист|\bбпд\b|правнич/u, "legal"]
  ];

  function matchTopics(services, question, lastTopic) {
    const plain = question.toLocaleLowerCase("uk");
    const explicit = subjectRules.filter(([pattern]) => pattern.test(plain) || pattern.test(normalized(plain)))
      .map(([, id]) => id).filter(id => services.some(service => service.id === id));
    if (explicit.includes("vlk") && explicit.includes("msek")) return ["vlk", "msek"];
    if (explicit.includes("rehab") && explicit.includes("benefits") && /^(протези?|реабілітація)\s+(і|й|та|або|и)\s+(пільг|виплат|льгот)/iu.test(plain.trim())) {
      return ["rehab", "benefits"];
    }
    if (explicit.includes("housing") && explicit.includes("missing-family") && /оренд|житл/u.test(plain)) return ["housing"];
    if (explicit.includes("work") && /бізнес|грант|ваучер/u.test(plain)) return ["work"];
    if (explicit.includes("vlk") && explicit.includes("injury") && /(?:скільки|виплат|грошове забезпечення|втрата працездатності)/u.test(plain)) return ["injury"];
    if (explicit.length) return [explicit[0]];
    if (lastTopic && /^(?:а\s+|і\s+)?(?:де|где|куди|куда|як|как|які|какие|скільки|коли|чи|що|что|а|і|и)(?=\s|[?!,.]|$)/iu.test(question.trim())) {
      return [lastTopic];
    }
    const match = findServices(services, question).find(service => {
      const routeWords = tokens(service.title + " " + service.keys);
      return queryWords(question).some(word => routeWords.some(term => similar(word, term)));
    });
    return match ? [match.id] : [];
  }

  function answerSections(service, question, previousSection) {
    const scored = service.sections.map(section => ({section, score: keywordScore(question, section.keys)}))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const appeal = service.sections.find(section => section.id === "appeal");
    if (appeal && /оскарж|скарг|незгод|не згод/u.test(question.toLocaleLowerCase("uk"))) return [appeal];
    if (best && best.score > 0) {
      const tied = scored.filter(({score}) => score === best.score).map(({section}) => section);
      return tied.length === 1 ? [best.section] : tied;
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

  function localAnswers(services, question, previous) {
    const routes = matchTopics(services, question, previous?.route);
    if (routes.length !== 1) return routes.map(route => ({route, section: null}));
    const route = routes[0];
    const service = services.find(item => item.id === route);
    if (!service) return [];
    const sections = answerSections(service, question, route === previous?.route ? previous.section : null);
    return sections.length ? sections.map(({id}) => ({route, section: id})) : [{route, section: null}];
  }

  function routeProgressSummary(id, preparation, checked) {
    const lists = Object.entries(preparation).filter(([key]) => key === id || key.startsWith(id + ":"));
    const primary = lists.find(([key]) => key === id);
    const active = lists.findLast(([key, list]) => list.items.some(([item]) => checked.includes(key + ":" + item)));
    const [key, list] = active ?? primary ?? [];
    if (!list) return {section: null, total: 0, completed: 0, next: null};
    const pending = list.items.find(([item]) => !checked.includes(key + ":" + item));
    return {
      section: list.section ?? null, total: list.items.length,
      completed: list.items.filter(([item]) => checked.includes(key + ":" + item)).length,
      next: pending?.[1] ?? null
    };
  }

  function parseAiAnswers(services, value) {
    if (!Array.isArray(value) || value.length > 2) throw new Error("Invalid assistant response");
    return value.map(item => {
      const {route, section} = item ?? {};
      const service = services.find(item => item.id === route);
      if (!service || (section !== null && !service.sections.some(item => item.id === section))) {
        throw new Error("Unknown catalogue entry");
      }
      return {route, section};
    });
  }

  return {findServices, matchTopics, answerSections, findContacts, localAnswers, parseAiAnswers, routeProgressSummary, normalized};
})();

if (typeof module !== "undefined") module.exports = guideSearch;
