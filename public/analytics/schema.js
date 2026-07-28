(() => {
  "use strict";

  const options = (items) => items.map(([value, label]) => ({ value: String(value), label }));

  const departments = options([
    [1, "Отдел продаж"], [2, "Пресейл"], [3, "Маркетинг"], ["other", "Другое"],
  ]);
  const clientFrequency = options([
    [1, "Каждый или почти каждый рабочий день"], [2, "Несколько раз в неделю"],
    [3, "Несколько раз в месяц"], [4, "Несколько раз в квартал"],
    [5, "Реже одного раза в квартал"], [97, "Не общаюсь напрямую с клиентами"],
  ]);
  const industries = options([
    [1, "Банки, финсектор, страхование"], [2, "Розничная торговля"], [3, "Госсектор"],
    [4, "Промышленность"], [5, "Транспорт и логистика"], [98, "Другое"],
  ]);
  const roles = options([
    [1, "Генеральный директор"], [2, "ИТ-директор / руководитель ИТ"],
    [3, "Руководитель информационной безопасности"], [4, "Руководитель закупок"],
    [5, "Другая управленческая должность"], [6, "Системный администратор"],
    [7, "Специалист по информационной безопасности"], [8, "DevOps-специалист"],
    [9, "Другой специалист ИТ-отдела"], [10, "Специалист по закупкам"],
    [11, "Юрист"], [98, "Другое"],
  ]);
  const contactFrequency = options([
    [1, "Часто"], [2, "Иногда"], [3, "Редко / эпизодически"], [4, "Контактировали один раз"],
  ]);
  const clientTasks = options([
    [1, "Замена устаревающего оборудования"], [2, "Рост уровня киберугроз"],
    [3, "Новые регуляторные требования"], [4, "Масштабирование инфраструктуры"],
    [5, "Импортозамещение"], [6, "Повышение надёжности инфраструктуры"],
    [7, "Оптимизация затрат"], [8, "Запуск цифровых продуктов"], [98, "Другое"],
  ]);
  const supplierFactors = options([
    [1, "Надёжность и репутация поставщика"], [2, "Успешные кейсы"],
    [3, "Соответствие требованиям ИБ"], [4, "Сертификаты и регуляторные требования"],
    [5, "Совместимость с инфраструктурой"], [6, "Стоимость закупки"],
    [7, "Сроки предоставления услуг"], [8, "Качество техподдержки"],
    [9, "Пилот / тестирование"], [10, "Рекомендации коллег"],
    [11, "Независимые рейтинги и обзоры"], [98, "Другое"], [99, "Затрудняюсь ответить"],
  ]);
  const negativeFrequency = options([
    [1, "Да, часто"], [2, "Да, иногда"], [3, "Да, редко"], [4, "Не встречали ни разу"],
  ]);
  const companyDistrust = options([
    [1, "Недостаточная известность компании"], [2, "Недостаток публичных кейсов"],
    [3, "Сомнения в технологической экспертизе"], [4, "Сомнения в финансовой устойчивости"],
    [5, "Сомнения в качестве техподдержки"], [6, "Опасения по срокам"],
    [7, "Непонимание преимуществ"], [8, "Негативный прошлый опыт"],
    [9, "Негативные отзывы коллег / СМИ"], [10, "Сомнения в соответствии требованиям"],
    [11, "Кейс, связанный с делом основателя"], [98, "Другое"], [99, "Затрудняюсь ответить"],
  ]);
  const productDistrust = options([
    [1, "Недостаточная известность продукта"], [2, "Недостаток отраслевых кейсов"],
    [3, "Сомнения в совместимости"], [4, "Сомнения в безопасности"],
    [5, "Сомнения в надёжности"], [6, "Сложность внедрения / эксплуатации"],
    [7, "Недостаток функциональности"], [8, "Высокая стоимость"],
    [9, "Недоверие к российским решениям"], [10, "Негативный прошлый опыт"],
    [98, "Другое"], [99, "Затрудняюсь ответить"],
  ]);
  const mediaSources = options([
    [1, "Деловые СМИ"], [2, "ИТ-СМИ и профессиональные сообщества"],
    [3, "Telegram-каналы"], [4, "YouTube-каналы"], [5, "Подкасты"],
    [98, "Другое"], [99, "Затрудняюсь ответить"],
  ]);
  const businessMedia = options([
    [1, "РБК"], [2, "Ведомости"], [3, "Коммерсантъ"], [4, "Forbes Russia"],
    [5, "Эксперт"], [6, "Секрет фирмы"], [7, "Профиль"], [8, "Inc."],
    [9, "Тинькофф Журнал"], [10, "RB.ru"], [98, "Другое"], [99, "Затрудняюсь ответить"],
  ]);
  const itMedia = options([
    [1, "Хабр"], [2, "VC.ru"], [3, "Skillbox Media"], [4, "Яндекс Практикум"],
    [5, "GeekBrains"], [6, "Tproger"], [7, "IT-World"], [8, "Hi-Tech Mail.ru"],
    [9, "SecurityLab"], [10, "Anti-Malware.ru"], [11, "Код ИБ"],
    [12, "CNews"], [13, "TAdviser"], [98, "Другое"], [99, "Затрудняюсь ответить"],
  ]);
  const eventAttendance = options([[1, "Да"], [2, "Нет"], [3, "Не владею информацией"]]);
  const eventFormats = options([
    [1, "Оффлайн-конференции / форумы"], [2, "Онлайн-конференции / форумы"],
    [3, "Семинары / воркшопы"], [4, "Круглые столы / дискуссии"],
    [5, "Вебинары"], [98, "Другое"], [99, "Затрудняюсь ответить"],
  ]);
  const attendanceDecision = options([
    [1, "Планируют на год вперёд"], [2, "Решают за несколько месяцев"],
    [3, "Решают за несколько недель"], [99, "Затрудняюсь ответить"],
  ]);
  const marketingMaterials = options([
    [1, "Отраслевые кейсы внедрения"], [2, "Кейсы по типовым задачам"],
    [3, "Независимые рейтинги и обзоры"], [4, "Сравнение с конкурентами"],
    [5, "Вебинары для клиентов"], [6, "Материалы для технических специалистов"],
    [98, "Другое"], [97, "Дополнительные материалы не нужны"],
  ]);

  const questions = [
    { key: "a1", code: "A1", title: "Отдел респондента", type: "single", options: departments },
    { key: "a2", code: "A2", title: "Частота общения с клиентами", type: "single", options: clientFrequency },
    { key: "a3", code: "A3", title: "Отрасли клиентов", type: "multi", options: industries },
    { key: "a4", code: "A4", title: "Должности со стороны клиента", type: "multi", options: roles },
    { key: "a5", prefix: "a5_", code: "A5", title: "Частота контакта по должностям", type: "matrix", rows: roles, options: contactFrequency },
    { key: "a6", code: "A6", title: "Задачи клиентов", type: "multi", options: clientTasks },
    { key: "a7", code: "A7", title: "Факторы выбора поставщика", type: "multi", options: supplierFactors },
    { key: "a8", code: "A8", title: "Ключевые факторы выбора", type: "multi", options: supplierFactors },
    { key: "b1", code: "B1", title: "Негатив о компании", type: "single", options: negativeFrequency },
    { key: "b2", code: "B2", title: "Кто сообщает негатив о компании", type: "multi", options: roles },
    { key: "b3", code: "B3", title: "Причины недоверия к компании", type: "multi", options: companyDistrust },
    { key: "b4", code: "B4", title: "Негатив о продукте", type: "single", options: negativeFrequency },
    { key: "b5", code: "B5", title: "Кто сообщает негатив о продукте", type: "multi", options: roles },
    { key: "b6", code: "B6", title: "Причины недоверия к продукту", type: "multi", options: productDistrust },
    { key: "b7", code: "B7", title: "Как снизить недоверие", type: "text", options: [] },
    { key: "c1", code: "C1", title: "Источники информации респондента", type: "multi", options: mediaSources },
    { key: "c2", code: "C2", title: "Деловые СМИ респондента", type: "multi", options: businessMedia },
    { key: "c3", code: "C3", title: "ИТ-СМИ респондента", type: "multi", options: itMedia },
    { key: "c4", code: "C4", title: "Telegram-каналы респондента", type: "list", options: [] },
    { key: "c5", code: "C5", title: "YouTube-каналы респондента", type: "list", options: [] },
    { key: "c6", code: "C6", title: "Подкасты респондента", type: "list", options: [] },
    { key: "c7", code: "C7", title: "Источники информации клиентов", type: "multi", options: mediaSources },
    { key: "c8", code: "C8", title: "Деловые СМИ клиентов", type: "multi", options: businessMedia },
    { key: "c9", code: "C9", title: "ИТ-СМИ клиентов", type: "multi", options: itMedia },
    { key: "c10", code: "C10", title: "Telegram-каналы клиентов", type: "list", options: [] },
    { key: "c11", code: "C11", title: "YouTube-каналы клиентов", type: "list", options: [] },
    { key: "c12", code: "C12", title: "Подкасты клиентов", type: "list", options: [] },
    { key: "c13", code: "C13", title: "Посещение профмероприятий", type: "single", options: eventAttendance },
    { key: "c14", code: "C14", title: "Форматы мероприятий", type: "multi", options: eventFormats },
    { key: "c15", prefix: "c15_", code: "C15", title: "Горизонт решения об участии", type: "matrix", rows: eventFormats, options: attendanceDecision },
    { key: "c16", code: "C16", title: "Недостающие маркетинговые материалы", type: "multi", options: marketingMaterials },
    { key: "c17", code: "C17", title: "Дополнительные наблюдения", type: "text", options: [] },
  ];

  const byKey = new Map(questions.map((question) => [question.key, question]));
  const labelFor = (question, value) => question?.options?.find((item) => item.value === String(value))?.label || String(value);
  const questionForAnswerKey = (key) => questions.find((question) => question.key === key || (question.prefix && key.startsWith(question.prefix)));

  window.AnalyticsSchema = {
    questions,
    byKey,
    labelFor,
    questionForAnswerKey,
    departments,
    clientFrequency,
    industries,
    negativeFrequency,
    eventAttendance,
  };
})();
