(() => {
  "use strict";

  const schema = window.AnalyticsSchema;
  const statusLabels = {
    completed: "Завершён",
    in_progress: "В процессе",
    screened_out: "Отсев",
  };
  const filterIds = [
    "filter-source", "filter-status", "filter-department", "filter-from", "filter-to",
    "filter-frequency", "filter-industry", "filter-company-negative", "filter-product-negative",
    "filter-event", "filter-search",
  ];

  const state = {
    records: [],
    filtered: [],
    rules: [],
    page: 1,
    pageSize: 25,
    sort: "updated_desc",
    generatedAt: "",
  };

  const el = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function plural(number, forms) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return forms[1];
    return forms[2];
  }

  function percent(part, total) {
    return total ? Math.round((part / total) * 100) : 0;
  }

  function shortDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function shortDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(date);
  }

  function setSelectOptions(select, items, allLabel = "Все") {
    select.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>${items
      .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
      .join("")}`;
  }

  function initializeSelects() {
    setSelectOptions(el("filter-department"), schema.departments, "Любой отдел");
    setSelectOptions(el("filter-frequency"), schema.clientFrequency, "Любая частота");
    setSelectOptions(el("filter-industry"), schema.industries, "Любая отрасль");
    setSelectOptions(el("filter-event"), schema.eventAttendance, "Любой ответ");

    const negativeOptions = [
      { value: "negative", label: "Есть негатив" },
      { value: "none", label: "Негатива нет" },
      ...schema.negativeFrequency,
    ];
    setSelectOptions(el("filter-company-negative"), negativeOptions, "Любой ответ");
    setSelectOptions(el("filter-product-negative"), negativeOptions, "Любой ответ");

    el("explorer-question").innerHTML = schema.questions
      .map((question) => `<option value="${question.key}"${question.key === "b1" ? " selected" : ""}>${question.code} · ${escapeHtml(question.title)}</option>`)
      .join("");
  }

  function answerValues(record, question) {
    if (!question) return [];
    if (question.type === "matrix") {
      return Object.entries(record.answers || {})
        .filter(([key, value]) => key.startsWith(question.prefix) && value !== "" && value != null)
        .map(([, value]) => String(value));
    }
    const value = record.answers?.[question.key];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (value == null || value === "") return [];
    return [String(value)];
  }

  function recordHas(record, key, value) {
    const current = record.answers?.[key];
    if (Array.isArray(current)) return current.map(String).includes(String(value));
    return String(current ?? "") === String(value);
  }

  function negativeMatch(value, filter) {
    if (filter === "all") return true;
    if (filter === "negative") return ["1", "2", "3"].includes(String(value || ""));
    if (filter === "none") return String(value || "") === "4";
    return String(value || "") === filter;
  }

  function searchableText(record) {
    return [record.id, record.status, ...Object.values(record.answers || {}).flat(Infinity)]
      .filter((value) => value != null)
      .join(" ")
      .toLocaleLowerCase("ru");
  }

  function ruleMatches(record, rule) {
    const question = schema.byKey.get(rule.question);
    if (!question) return true;
    const values = answerValues(record, question);
    if (rule.operator === "answered") return values.some((value) => value.trim());
    if (rule.operator === "unanswered") return !values.some((value) => value.trim());
    const needle = String(rule.value || "").toLocaleLowerCase("ru");
    if (!needle) return true;
    if (rule.operator === "has") return values.some((value) => value.toLocaleLowerCase("ru") === needle);
    if (rule.operator === "not_has") return !values.some((value) => value.toLocaleLowerCase("ru") === needle);
    if (rule.operator === "text") return values.some((value) => value.toLocaleLowerCase("ru").includes(needle));
    return true;
  }

  function applyFilters() {
    const source = el("filter-source").value;
    const status = el("filter-status").value;
    const department = el("filter-department").value;
    const from = el("filter-from").value;
    const to = el("filter-to").value;
    const frequency = el("filter-frequency").value;
    const industry = el("filter-industry").value;
    const companyNegative = el("filter-company-negative").value;
    const productNegative = el("filter-product-negative").value;
    const eventAttendance = el("filter-event").value;
    const search = el("filter-search").value.trim().toLocaleLowerCase("ru");
    const rulesMode = el("rules-mode").value;

    state.filtered = state.records.filter((record) => {
      if (source === "real" && record.isTest) return false;
      if (source === "test" && !record.isTest) return false;
      if (status !== "all" && record.status !== status) return false;
      if (department !== "all" && !recordHas(record, "a1", department)) return false;
      if (frequency !== "all" && !recordHas(record, "a2", frequency)) return false;
      if (industry !== "all" && !recordHas(record, "a3", industry)) return false;
      if (!negativeMatch(record.answers?.b1, companyNegative)) return false;
      if (!negativeMatch(record.answers?.b4, productNegative)) return false;
      if (eventAttendance !== "all" && !recordHas(record, "c13", eventAttendance)) return false;

      const created = String(record.createdAt || "").slice(0, 10);
      if (from && created < from) return false;
      if (to && created > to) return false;
      if (search && !searchableText(record).includes(search)) return false;

      if (state.rules.length) {
        const results = state.rules.map((rule) => ruleMatches(record, rule));
        if (rulesMode === "all" && !results.every(Boolean)) return false;
        if (rulesMode === "any" && !results.some(Boolean)) return false;
      }
      return true;
    });

    state.page = 1;
    syncUrl();
    renderAll();
  }

  function syncUrl() {
    const params = new URLSearchParams();
    for (const id of filterIds) {
      const control = el(id);
      const defaultValue = control.tagName === "SELECT" ? "all" : "";
      if (control.value && control.value !== defaultValue) params.set(id.replace("filter-", ""), control.value);
    }
    if (state.rules.length) params.set("rules", JSON.stringify(state.rules));
    if (el("rules-mode").value !== "all") params.set("mode", el("rules-mode").value);
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}`);
  }

  function restoreUrl() {
    const params = new URLSearchParams(location.search);
    for (const id of filterIds) {
      const control = el(id);
      const value = params.get(id.replace("filter-", ""));
      if (value != null && control.tagName === "SELECT" && [...control.options].some((option) => option.value === value)) control.value = value;
      if (value != null && control.tagName === "INPUT") control.value = value;
    }
    if (params.get("mode") === "any") el("rules-mode").value = "any";
    try {
      const parsed = JSON.parse(params.get("rules") || "[]");
      if (Array.isArray(parsed)) state.rules = parsed.slice(0, 12);
    } catch {
      state.rules = [];
    }
  }

  function completionPercent(record) {
    if (record.status === "completed") return 100;
    if (record.status === "screened_out") return 7;
    const answered = schema.questions.filter((question) => answerValues(record, question).length).length;
    return Math.min(96, Math.round((answered / schema.questions.length) * 100));
  }

  function distribution(records, questionKey) {
    const question = schema.byKey.get(questionKey);
    if (!question) return { items: [], base: 0 };
    const counts = new Map(question.options.map((item) => [item.value, 0]));
    let base = 0;

    for (const record of records) {
      const values = answerValues(record, question);
      if (!values.length) continue;
      base += question.type === "matrix" ? values.length : 1;
      const countableValues = question.type === "matrix" ? values : [...new Set(values)];
      for (const value of countableValues) counts.set(value, (counts.get(value) || 0) + 1);
    }

    const items = [...counts.entries()]
      .filter(([, count]) => count > 0)
      .map(([value, count]) => ({ value, label: schema.labelFor(question, value), count, pct: percent(count, base) }))
      .sort((left, right) => right.count - left.count);
    return { items, base };
  }

  function renderBarChart(target, questionKey, limit = 7) {
    const { items, base } = distribution(state.filtered, questionKey);
    if (!items.length) {
      target.innerHTML = '<div class="bar-empty">Нет данных для выбранного среза</div>';
      return;
    }
    target.innerHTML = items.slice(0, limit).map((item) => `
      <div class="bar-row">
        <div class="bar-meta"><span title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span><strong>${item.pct}% · ${item.count}</strong></div>
        <div class="bar-track"><div class="bar-fill" data-pct="${item.pct}"></div></div>
      </div>`).join("");
    target.querySelectorAll("[data-pct]").forEach((node) => node.style.setProperty("--value", node.dataset.pct));
    target.setAttribute("aria-label", `Распределение по ${base} ответам`);
  }

  function renderKpis() {
    const total = state.filtered.length;
    const completed = state.filtered.filter((record) => record.status === "completed").length;
    const companyBase = state.filtered.filter((record) => record.answers?.b1).length;
    const companyNegative = state.filtered.filter((record) => ["1", "2", "3"].includes(String(record.answers?.b1 || ""))).length;
    const productBase = state.filtered.filter((record) => record.answers?.b4).length;
    const productNegative = state.filtered.filter((record) => ["1", "2", "3"].includes(String(record.answers?.b4 || ""))).length;

    el("kpi-total").textContent = total.toLocaleString("ru-RU");
    el("kpi-total-note").textContent = `из ${state.records.length.toLocaleString("ru-RU")} всего`;
    el("kpi-completed").textContent = `${percent(completed, total)}%`;
    el("kpi-completed-note").textContent = `${completed} ${plural(completed, ["анкета", "анкеты", "анкет"])}`;
    el("kpi-company-negative").textContent = companyBase ? `${percent(companyNegative, companyBase)}%` : "—";
    el("kpi-company-negative-note").textContent = companyBase ? `${companyNegative} из ${companyBase}` : "нет ответов";
    el("kpi-product-negative").textContent = productBase ? `${percent(productNegative, productBase)}%` : "—";
    el("kpi-product-negative-note").textContent = productBase ? `${productNegative} из ${productBase}` : "нет ответов";
    el("filtered-count").textContent = `${total} ${plural(total, ["ответ", "ответа", "ответов"])}`;
  }

  function mondayKey(value) {
    const date = new Date(`${value}T12:00:00Z`);
    const day = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - day);
    return date.toISOString().slice(0, 10);
  }

  function renderTrend() {
    const target = el("trend-chart");
    if (!state.filtered.length) {
      target.innerHTML = '<div class="bar-empty">Нет данных</div>';
      el("trend-period").textContent = "—";
      return;
    }
    const dates = state.filtered.map((record) => String(record.createdAt || "").slice(0, 10)).filter(Boolean).sort();
    const span = (new Date(dates.at(-1)) - new Date(dates[0])) / 86400000;
    const weekly = span > 34;
    const buckets = new Map();
    for (const record of state.filtered) {
      const raw = String(record.createdAt || "").slice(0, 10);
      if (!raw) continue;
      const key = weekly ? mondayKey(raw) : raw;
      const bucket = buckets.get(key) || { completed: 0, other: 0 };
      if (record.status === "completed") bucket.completed += 1;
      else bucket.other += 1;
      buckets.set(key, bucket);
    }
    const rows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
    const maximum = Math.max(1, ...rows.map(([, item]) => item.completed + item.other));
    target.style.setProperty("--columns", rows.length);
    target.innerHTML = rows.map(([key, item], index) => {
      const completeHeight = Math.round((item.completed / maximum) * 100);
      const otherHeight = Math.round((item.other / maximum) * 100);
      const showLabel = rows.length <= 14 || index % Math.ceil(rows.length / 10) === 0 || index === rows.length - 1;
      const label = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(`${key}T12:00:00Z`));
      return `<div class="trend-column" title="${escapeHtml(label)}: ${item.completed + item.other}">
        <i class="trend-bar trend-bar-complete" data-pct="${completeHeight}"></i>
        <i class="trend-bar trend-bar-progress" data-pct="${otherHeight}"></i>
        ${showLabel ? `<span class="trend-label">${escapeHtml(label)}</span>` : ""}
      </div>`;
    }).join("");
    target.querySelectorAll("[data-pct]").forEach((node) => node.style.setProperty("--value", node.dataset.pct));
    el("trend-period").textContent = weekly ? `${rows.length} недель` : `${rows.length} дней`;
  }

  function renderSentiment() {
    const target = el("sentiment-chart");
    const definitions = [
      { key: "b1", title: "Компания" },
      { key: "b4", title: "Продукт Скала^р" },
    ];
    target.innerHTML = definitions.map((definition) => {
      const question = schema.byKey.get(definition.key);
      const records = state.filtered.filter((record) => answerValues(record, question).length);
      const counts = question.options.map((option) => records.filter((record) => recordHas(record, definition.key, option.value)).length);
      const negative = counts.slice(0, 3).reduce((sum, value) => sum + value, 0);
      return `<div class="sentiment-block">
        <div class="sentiment-title"><span>${escapeHtml(definition.title)}</span><strong>${records.length ? `${percent(negative, records.length)}% с негативом` : "нет данных"}</strong></div>
        <div class="sentiment-stack">${counts.map((count) => `<i class="sentiment-segment" data-pct="${percent(count, records.length)}" title="${count}"></i>`).join("")}</div>
        <div class="sentiment-key">${question.options.map((option, index) => `<span><i class="segment-color-${index + 1}"></i>${escapeHtml(option.label)} · ${counts[index]}</span>`).join("")}</div>
      </div>`;
    }).join("");
    target.querySelectorAll("[data-pct]").forEach((node) => node.style.setProperty("--value", node.dataset.pct));
  }

  function renderDistrust() {
    const target = el("distrust-chart");
    const groups = [
      { title: "Компания", key: "b3" },
      { title: "Продукт", key: "b6" },
    ];
    target.innerHTML = groups.map((group) => {
      const { items } = distribution(state.filtered, group.key);
      return `<div class="dual-group"><div class="dual-title">${group.title}</div>${items.slice(0, 4).map((item) => `
        <div class="bar-row"><div class="bar-meta"><span>${escapeHtml(item.label)}</span><strong>${item.pct}%</strong></div><div class="bar-track"><div class="bar-fill" data-pct="${item.pct}"></div></div></div>`).join("") || '<div class="bar-empty">Нет данных</div>'}</div>`;
    }).join("");
    target.querySelectorAll("[data-pct]").forEach((node) => node.style.setProperty("--value", node.dataset.pct));
  }

  function segmentDefinition(type, record) {
    if (type === "department") {
      const value = String(record.answers?.a1 || "none");
      return { key: value, label: schema.labelFor(schema.byKey.get("a1"), value) || "Нет ответа" };
    }
    if (type === "source") return record.isTest ? { key: "test", label: "Тестовые" } : { key: "real", label: "Реальные" };
    if (type === "status") return { key: record.status, label: statusLabels[record.status] || record.status };
    if (type === "companyNegative") {
      if (["1", "2", "3"].includes(String(record.answers?.b1 || ""))) return { key: "negative", label: "Есть негатив" };
      if (String(record.answers?.b1 || "") === "4") return { key: "none", label: "Негатива нет" };
      return { key: "unknown", label: "Нет ответа" };
    }
    return { key: "all", label: "Все ответы" };
  }

  function renderExplorer() {
    const question = schema.byKey.get(el("explorer-question").value) || schema.byKey.get("b1");
    const segmentType = el("explorer-segment").value;
    const target = el("explorer-chart");
    const answeredRecords = state.filtered.filter((record) => answerValues(record, question).length);
    el("explorer-description").textContent = `${question.code}. ${question.title} · ответили ${answeredRecords.length} из ${state.filtered.length}`;

    if (["text", "list"].includes(question.type)) {
      const values = answeredRecords.flatMap((record) => answerValues(record, question)).filter((value) => value.trim());
      target.innerHTML = values.length
        ? `<div class="text-insights">${values.slice(0, 16).map((value) => `<div class="text-insight">${escapeHtml(value)}</div>`).join("")}</div>`
        : '<div class="bar-empty">В выбранном срезе нет текстовых ответов</div>';
      return;
    }

    const { items, base } = distribution(state.filtered, question.key);
    if (!items.length) {
      target.innerHTML = '<div class="bar-empty">Нет данных для выбранного среза</div>';
      return;
    }

    const segments = new Map();
    for (const record of state.filtered) {
      const segment = segmentDefinition(segmentType, record);
      if (!segments.has(segment.key)) segments.set(segment.key, segment.label);
    }
    const segmentEntries = [...segments.entries()].slice(0, 6);
    const legend = segmentType === "none" ? "" : `<div class="segment-legend">${segmentEntries.map(([key, label], index) => `<span><i class="segment-color-${index + 1}"></i>${escapeHtml(label)}</span>`).join("")}</div>`;

    const rows = items.slice(0, 15).map((item) => {
      const pieces = segmentEntries.map(([segmentKey], index) => {
        let count = 0;
        for (const record of state.filtered) {
          if (segmentDefinition(segmentType, record).key !== segmentKey) continue;
          const values = answerValues(record, question);
          count += question.type === "matrix"
            ? values.filter((value) => value === item.value).length
            : Number(values.includes(item.value));
        }
        return { count, pct: percent(count, base) };
      });
      return `<div class="explorer-row">
        <div class="explorer-label">${escapeHtml(item.label)}</div>
        <div class="segment-list">${pieces.map((piece) => `<i class="segment-fill" data-pct="${piece.pct}"></i>`).join("")}</div>
        <div class="explorer-value">${item.pct}% · ${item.count}</div>
      </div>`;
    }).join("");
    target.innerHTML = `${legend}${rows}`;
    target.querySelectorAll("[data-pct]").forEach((node) => node.style.setProperty("--value", node.dataset.pct));
  }

  function renderRules() {
    const target = el("advanced-rules");
    target.innerHTML = state.rules.map((rule, index) => {
      const question = schema.byKey.get(rule.question) || schema.questions[0];
      const hasOptions = question.options.length > 0;
      const operators = hasOptions
        ? [["has", "содержит"], ["not_has", "не содержит"], ["answered", "заполнено"], ["unanswered", "не заполнено"]]
        : [["text", "текст содержит"], ["answered", "заполнено"], ["unanswered", "не заполнено"]];
      const needsValue = !["answered", "unanswered"].includes(rule.operator);
      return `<div class="rule" data-rule-index="${index}">
        <button class="rule-remove" type="button" data-remove-rule="${index}" aria-label="Удалить условие">×</button>
        <select data-rule-field="question">${schema.questions.map((item) => `<option value="${item.key}"${item.key === question.key ? " selected" : ""}>${item.code} · ${escapeHtml(item.title)}</option>`).join("")}</select>
        <select data-rule-field="operator">${operators.map(([value, label]) => `<option value="${value}"${value === rule.operator ? " selected" : ""}>${label}</option>`).join("")}</select>
        ${needsValue ? (hasOptions
          ? `<select data-rule-field="value">${question.options.map((item) => `<option value="${escapeHtml(item.value)}"${String(item.value) === String(rule.value) ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select>`
          : `<input data-rule-field="value" value="${escapeHtml(rule.value || "")}" placeholder="Введите фрагмент" />`) : ""}
      </div>`;
    }).join("");
  }

  function renderCharts() {
    renderTrend();
    renderSentiment();
    renderBarChart(el("department-chart"), "a1", 6);
    renderBarChart(el("industry-chart"), "a3", 7);
    renderBarChart(el("factor-chart"), "a8", 7);
    renderDistrust();
    renderBarChart(el("media-chart"), "c7", 7);
    renderBarChart(el("materials-chart"), "c16", 7);
    renderExplorer();
  }

  function sortedRecords() {
    const records = [...state.filtered];
    if (state.sort === "updated_asc") records.sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")));
    if (state.sort === "updated_desc") records.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (state.sort === "completion_desc") records.sort((a, b) => completionPercent(b) - completionPercent(a));
    return records;
  }

  function answerLabel(record, key) {
    const question = schema.byKey.get(key);
    const value = record.answers?.[key];
    if (!value) return "—";
    const label = schema.labelFor(question, value);
    const other = record.answers?.[`${key}_other`];
    return other && ["98", "other"].includes(String(value)) ? `${label}: ${other}` : label;
  }

  function renderTable() {
    const records = sortedRecords();
    const pages = Math.max(1, Math.ceil(records.length / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const pageRecords = records.slice(start, start + state.pageSize);

    el("responses-body").innerHTML = pageRecords.map((record) => {
      const completion = completionPercent(record);
      const negative = [record.answers?.b1, record.answers?.b4].some((value) => ["1", "2", "3"].includes(String(value || "")))
        ? "Есть" : [record.answers?.b1, record.answers?.b4].every((value) => String(value || "") === "4") ? "Нет" : "—";
      return `<tr>
        <td>${escapeHtml(shortDate(record.updatedAt))}</td>
        <td><span class="source-pill ${record.isTest ? "source-test" : "source-real"}">${record.isTest ? "Тест" : "Реальный"}</span></td>
        <td><span class="status-pill status-${escapeHtml(record.status)}">${escapeHtml(statusLabels[record.status] || record.status)}</span></td>
        <td>${escapeHtml(answerLabel(record, "a1"))}</td>
        <td>${escapeHtml(answerLabel(record, "a2"))}</td>
        <td>${negative}</td>
        <td><span class="completion"><i class="completion-track"><b class="completion-fill" data-pct="${completion}"></b></i>${completion}%</span></td>
        <td><button class="row-open" type="button" data-open-record="${escapeHtml(record.id)}">Открыть</button></td>
      </tr>`;
    }).join("") || '<tr><td colspan="8"><div class="bar-empty">Нет прохождений по выбранным условиям</div></td></tr>';
    el("responses-body").querySelectorAll("[data-pct]").forEach((node) => node.style.setProperty("--value", node.dataset.pct));
    el("page-info").textContent = records.length ? `${start + 1}–${Math.min(start + state.pageSize, records.length)} из ${records.length}` : "0 ответов";
    el("page-prev").disabled = state.page <= 1;
    el("page-next").disabled = state.page >= pages;
  }

  function formatQuestionAnswer(record, question) {
    if (question.type === "matrix") {
      return Object.entries(record.answers || {})
        .filter(([key, value]) => key.startsWith(question.prefix) && value)
        .map(([key, value]) => {
          const rowValue = key.slice(question.prefix.length);
          const rowLabel = question.rows?.find((item) => item.value === rowValue)?.label || rowValue;
          return `${rowLabel} — ${schema.labelFor(question, value)}`;
        }).join("\n");
    }
    const values = answerValues(record, question);
    if (!values.length) return "";
    if (["text", "list"].includes(question.type)) return values.join("\n");
    const custom = record.answers?.[`${question.key}_other`];
    return values.map((value) => {
      const label = schema.labelFor(question, value);
      return custom && ["98", "other"].includes(value) ? `${label}: ${custom}` : label;
    }).join(", ");
  }

  function openRecord(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    el("drawer-title").textContent = `Ответ от ${shortDate(record.updatedAt)}`;
    el("drawer-meta").innerHTML = `
      <span class="source-pill ${record.isTest ? "source-test" : "source-real"}">${record.isTest ? "Тестовые данные" : "Реальный ответ"}</span>
      <span class="status-pill status-${escapeHtml(record.status)}">${escapeHtml(statusLabels[record.status] || record.status)}</span>
      <span class="status-pill status-screened_out">Заполнение ${completionPercent(record)}%</span>`;
    el("drawer-content").innerHTML = schema.questions.map((question) => {
      const answer = formatQuestionAnswer(record, question);
      if (!answer) return "";
      return `<div class="answer-row"><div class="answer-question">${question.code} · ${escapeHtml(question.title)}</div><div class="answer-value">${escapeHtml(answer)}</div></div>`;
    }).join("");
    el("drawer-backdrop").hidden = false;
    el("response-drawer").classList.add("is-open");
    el("response-drawer").setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    el("response-drawer").classList.remove("is-open");
    el("response-drawer").setAttribute("aria-hidden", "true");
    window.setTimeout(() => { el("drawer-backdrop").hidden = true; }, 320);
  }

  function renderPresets() {
    document.querySelectorAll("[data-preset]").forEach((button) => {
      const active = (button.dataset.preset === "real" && el("filter-source").value === "real")
        || (button.dataset.preset === "completed" && el("filter-status").value === "completed")
        || (button.dataset.preset === "negative" && el("filter-company-negative").value === "negative")
        || (button.dataset.preset === "events" && el("filter-event").value === "1");
      button.classList.toggle("is-active", active);
    });
  }

  function renderAll() {
    renderKpis();
    renderCharts();
    renderTable();
    renderPresets();
  }

  function showToast(message) {
    const toast = el("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function csvCell(value) {
    const text = String(value ?? "").replaceAll('"', '""');
    return `"${text}"`;
  }

  function exportCsv() {
    const answerKeys = [...new Set(state.filtered.flatMap((record) => Object.keys(record.answers || {})))].sort();
    const header = ["id", "source", "status", "createdAt", "updatedAt", ...answerKeys];
    const rows = state.filtered.map((record) => [
      record.id,
      record.isTest ? "test" : "real",
      record.status,
      record.createdAt,
      record.updatedAt,
      ...answerKeys.map((key) => {
        const question = schema.questionForAnswerKey(key);
        const value = record.answers?.[key];
        if (Array.isArray(value)) return value.map((item) => schema.labelFor(question, item)).join(" | ");
        return question && question.options?.length ? schema.labelFor(question, value) : value ?? "";
      }),
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `reputation-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(href);
    showToast(`Экспортировано: ${state.filtered.length} ответов`);
  }

  function resetFilters() {
    for (const id of filterIds) {
      const control = el(id);
      control.value = control.tagName === "SELECT" ? "all" : "";
    }
    state.rules = [];
    el("rules-mode").value = "all";
    renderRules();
    applyFilters();
  }

  function addRule() {
    const question = schema.questions[0];
    state.rules.push({ question: question.key, operator: "has", value: question.options[0]?.value || "" });
    renderRules();
    applyFilters();
  }

  async function copyView() {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast("Ссылка на текущий срез скопирована");
    } catch {
      showToast("Не удалось скопировать ссылку");
    }
  }

  function bindEvents() {
    for (const id of filterIds) {
      const control = el(id);
      control.addEventListener(control.type === "search" ? "input" : "change", applyFilters);
    }
    el("rules-mode").addEventListener("change", applyFilters);
    el("add-rule").addEventListener("click", addRule);
    el("reset-filters").addEventListener("click", resetFilters);
    el("explorer-question").addEventListener("change", renderExplorer);
    el("explorer-segment").addEventListener("change", renderExplorer);
    el("page-size").addEventListener("change", () => { state.pageSize = Number(el("page-size").value); state.page = 1; renderTable(); });
    el("table-sort").addEventListener("change", () => { state.sort = el("table-sort").value; renderTable(); });
    el("page-prev").addEventListener("click", () => { state.page = Math.max(1, state.page - 1); renderTable(); });
    el("page-next").addEventListener("click", () => { state.page += 1; renderTable(); });
    el("export-csv").addEventListener("click", exportCsv);
    el("copy-view").addEventListener("click", copyView);
    el("close-drawer").addEventListener("click", closeDrawer);
    el("drawer-backdrop").addEventListener("click", closeDrawer);
    el("mobile-filter-toggle").addEventListener("click", () => el("filters").classList.add("is-open"));
    el("close-filters").addEventListener("click", () => el("filters").classList.remove("is-open"));
    el("retry-load").addEventListener("click", loadData);

    document.addEventListener("click", (event) => {
      const preset = event.target.closest("[data-preset]");
      if (preset) {
        if (preset.dataset.preset === "real") el("filter-source").value = el("filter-source").value === "real" ? "all" : "real";
        if (preset.dataset.preset === "completed") el("filter-status").value = el("filter-status").value === "completed" ? "all" : "completed";
        if (preset.dataset.preset === "negative") el("filter-company-negative").value = el("filter-company-negative").value === "negative" ? "all" : "negative";
        if (preset.dataset.preset === "events") el("filter-event").value = el("filter-event").value === "1" ? "all" : "1";
        applyFilters();
      }
      const open = event.target.closest("[data-open-record]");
      if (open) openRecord(open.dataset.openRecord);
      const remove = event.target.closest("[data-remove-rule]");
      if (remove) {
        state.rules.splice(Number(remove.dataset.removeRule), 1);
        renderRules();
        applyFilters();
      }
    });

    el("advanced-rules").addEventListener("change", (event) => {
      const row = event.target.closest("[data-rule-index]");
      if (!row || !event.target.dataset.ruleField) return;
      const index = Number(row.dataset.ruleIndex);
      const field = event.target.dataset.ruleField;
      state.rules[index][field] = event.target.value;
      if (field === "question") {
        const question = schema.byKey.get(event.target.value);
        state.rules[index].operator = question.options.length ? "has" : "text";
        state.rules[index].value = question.options[0]?.value || "";
      }
      if (field === "operator" && ["answered", "unanswered"].includes(event.target.value)) state.rules[index].value = "";
      renderRules();
      applyFilters();
    });
    el("advanced-rules").addEventListener("input", (event) => {
      const row = event.target.closest("[data-rule-index]");
      if (!row || event.target.dataset.ruleField !== "value") return;
      state.rules[Number(row.dataset.ruleIndex)].value = event.target.value;
      window.clearTimeout(bindEvents.ruleTimer);
      bindEvents.ruleTimer = window.setTimeout(applyFilters, 180);
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  }

  async function loadData() {
    el("loading").hidden = false;
    el("error-screen").hidden = true;
    try {
      const response = await fetch("../api/analytics/responses", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Сервер вернул статус ${response.status}`);
      const payload = await response.json();
      state.records = (payload.records || []).map((record) => ({
        ...record,
        isTest: Boolean(record.isTest || String(record.id || "").startsWith("test-")),
        answers: record.answers || {},
      }));
      state.generatedAt = payload.generatedAt;
      el("freshness").textContent = `Обновлено ${shortDateTime(payload.generatedAt)}`;
      applyFilters();
    } catch (error) {
      el("error-message").textContent = error?.message || "Обновите страницу и попробуйте снова.";
      el("error-screen").hidden = false;
    } finally {
      el("loading").hidden = true;
    }
  }

  initializeSelects();
  restoreUrl();
  renderRules();
  bindEvents();
  loadData();
})();
