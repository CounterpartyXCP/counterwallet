// More locales can be found in src/vendors/jquery-timeago/locales/
function switchTimeagoLocale(locale)
{ 
  switch(locale)
  {
    case "cs":
      // Czech
      jQuery.timeago.settings.strings = {
        prefixAgo: "před",
        prefixFromNow: null,
        suffixAgo: null,
        suffixFromNow: null,
        seconds: "méně než minutou",
        minute: "minutou",
        minutes: "%d minutami",
        hour: "hodinou",
        hours: "%d hodinami",
        day: "1 dnem",
        days: "%d dny",
        month: "1 měsícem",
        months: "%d měsíci",
        year: "1 rokem",
        years: "%d roky"
      };
      break;
    case "da":
      // Danish
      jQuery.timeago.settings.strings = {
        prefixAgo: "for",
        prefixFromNow: "om",
        suffixAgo: "siden",
        suffixFromNow: "",
        seconds: "mindre end et minut",
        minute: "ca. et minut",
        minutes: "%d minutter",
        hour: "ca. en time",
        hours: "ca. %d timer",
        day: "en dag",
        days: "%d dage",
        month: "ca. en måned",
        months: "%d måneder",
        year: "ca. et år",
        years: "%d år"
      };
      break;
    case "it":
      // Italian
      jQuery.timeago.settings.strings = {
        suffixAgo: "fa",
        suffixFromNow: "da ora",
        seconds: "meno di un minuto",
        minute: "circa un minuto",
        minutes: "%d minuti",
        hour: "circa un'ora",
        hours: "circa %d ore",
        day: "un giorno",
        days: "%d giorni",
        month: "circa un mese",
        months: "%d mesi",
        year: "circa un anno",
        years: "%d anni"
      };
      break;
    case "ru":
      // Russian
      (function() {
        function numpf(n, f, s, t) {
          // f - 1, 21, 31, ...
          // s - 2-4, 22-24, 32-34 ...
          // t - 5-20, 25-30, ...
          var n10 = n % 10;
          if ( (n10 == 1) && ( (n == 1) || (n > 20) ) ) {
            return f;
          } else if ( (n10 > 1) && (n10 < 5) && ( (n > 20) || (n < 10) ) ) {
            return s;
          } else {
            return t;
          }
        }

        jQuery.timeago.settings.strings = {
          prefixAgo: null,
          prefixFromNow: "через",
          suffixAgo: "назад",
          suffixFromNow: null,
          seconds: "меньше минуты",
          minute: "минуту",
          minutes: function(value) { return numpf(value, "%d минута", "%d минуты", "%d минут"); },
          hour: "час",
          hours: function(value) { return numpf(value, "%d час", "%d часа", "%d часов"); },
          day: "день",
          days: function(value) { return numpf(value, "%d день", "%d дня", "%d дней"); },
          month: "месяц",
          months: function(value) { return numpf(value, "%d месяц", "%d месяца", "%d месяцев"); },
          year: "год",
          years: function(value) { return numpf(value, "%d год", "%d года", "%d лет"); }
        };
      })();
      break;
    case "zh_cn":
      // Simplified Chinese
      jQuery.timeago.settings.strings = {
        prefixAgo: null,
        prefixFromNow: "从现在开始",
        suffixAgo: "之前",
        suffixFromNow: null,
        seconds: "不到 1 分钟",
        minute: "大约 1 分钟",
        minutes: "%d 分钟",
        hour: "大约 1 小时",
        hours: "大约 %d 小时",
        day: "1 天",
        days: "%d 天",
        month: "大约 1 个月",
        months: "%d 月",
        year: "大约 1 年",
        years: "%d 年",
        numbers: [],
        wordSeparator: ""
      };
      break;
    case "zh_tw":
      // Traditional Chinese
      jQuery.timeago.settings.strings = {
        prefixAgo: null,
        prefixFromNow: "從現在開始",
        suffixAgo: "之前",
        suffixFromNow: null,
        seconds: "不到 1 分鐘",
        minute: "大約 1 分鐘",
        minutes: "%d 分鐘",
        hour: "大約 1 小時",
        hours: "%d 小時",
        day: "大約 1 天",
        days: "%d 天",
        month: "大約 1 個月",
        months: "%d 個月",
        year: "大約 1 年",
        years: "%d 年",
        numbers: [],
        wordSeparator: ""
      };
      break;
    default:
      jQuery.timeago.settings.strings = {
        prefixAgo: null,
        prefixFromNow: null,
        suffixAgo: "ago",
        suffixFromNow: "from now",
        seconds: "less than a minute",
        minute: "about a minute",
        minutes: "%d minutes",
        hour: "about an hour",
        hours: "about %d hours",
        day: "a day",
        days: "%d days",
        month: "about a month",
        months: "%d months",
        year: "about a year",
        years: "%d years",
        wordSeparator: " ",
        numbers: []
      };
  }
};
