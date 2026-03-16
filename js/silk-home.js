(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-10';
  var DEFAULT_LANG = 'zh';

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function isMobileViewport() {
    return window.innerWidth < 700;
  }

  function getLang() {
    var hash = (window.location.hash || '').toLowerCase();
    if (hash === '#en' || hash === '#english') return 'en';
    if (hash === '#zh' || hash === '#cn') return 'zh';
    try {
      return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
    } catch (_) {
      return DEFAULT_LANG;
    }
  }

  function setLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
    if (lang === 'en') {
      window.location.hash = 'en';
    } else {
      window.location.hash = '';
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || '';
  }

  function setHTML(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value || '';
  }

  function renderContactLine(data, lang) {
    var contact = (data.basics && data.basics.contact) || {};
    var items = [];
    if (contact.phone) items.push((lang === 'en' ? 'Tel' : '电话') + '：' + contact.phone);
    if (contact.email) items.push('Email：' + contact.email);
    if (contact.resumeRepo) items.push((lang === 'en' ? 'Resume' : '简历') + '：' + contact.resumeRepo);
    return '<p class="letter-contact">' + escapeHtml(items.join('  ·  ')) + '</p>';
  }

  function buildNarrative(lang, mobile) {
    if (lang === 'en') {
      return {
        targetRole: 'AI Tech Lead / Engineering Manager',
        tagline: 'AI-assisted full-stack delivery leader.',
        title: 'Application Recommendation',
        p1: mobile
          ? 'I recommend Xie Baoxin for senior technical management interviews. He can quickly decompose business targets into executable milestones and keep delivery stable under pressure.'
          : 'I recommend Xie Baoxin as a strong senior technical management candidate. He can quickly decompose ambitious business targets into executable milestones, and he keeps delivery rhythm stable even under complex constraints.',
        p2: mobile
          ? 'He integrates Cursor / Claude into engineering workflow, balances quality with speed, and can align product, engineering and operations toward measurable outcomes.'
          : 'He integrates Cursor / Claude into engineering workflow to improve delivery efficiency without compromising quality, and he is highly effective in aligning product, engineering and operations toward measurable outcomes.'
      };
    }
    return {
      targetRole: 'AI 技术负责人 / 工程管理',
      tagline: 'AI 辅助研发与全栈交付负责人。',
      title: '应聘推荐书',
      p1: mobile
        ? '建议将谢宝新作为高级技术管理岗重点面试人选。他能快速拆解业务目标并稳定推进里程碑交付，在复杂约束下仍保持高执行力。'
        : '建议将谢宝新作为高级技术管理岗重点面试人选。他能够将复杂业务目标快速拆解为可执行里程碑，并在多约束环境下持续稳定推进交付，兼顾结果、节奏与质量。',
      p2: mobile
        ? '他善于将 Cursor / Claude 等 AI 工具融入工程流程，在效率与质量之间取得平衡，并能高效协同产品、研发与运营团队。'
        : '他善于将 Cursor / Claude 等 AI 工具融入工程流程，在效率与质量之间取得平衡；同时具备跨团队推进能力，能在产品、研发与运营之间建立高效协同并形成可量化结果。'
    };
  }

  function applyData(data) {
    var d = document;
    var lang = (data.meta && data.meta.lang) === 'en' ? 'en' : 'zh';
    var mobile = isMobileViewport();
    var basics = data.basics || {};
    var highlight = data.highlight || {};
    var narrative = buildNarrative(lang, mobile);

    setText('name', data.name || '');
    setText('basicsLine', [basics.genderAge, basics.location, basics.yearsExp].filter(Boolean).join(' · '));
    setText('targetRole', narrative.targetRole);
    setText('tagline', narrative.tagline);
    setHTML('contact', renderContactLine(data, lang));

    setText('highlightTitle', narrative.title);
    setText('highlightCompany', highlight.company || '');
    setText('highlightPeriod', highlight.period || '');
    setText('highlightRole', '');
    setHTML(
      'highlightProducts',
      '<p class="letter-paragraph">' + escapeHtml(narrative.p1) + '</p>' +
      '<p class="letter-paragraph">' + escapeHtml(narrative.p2) + '</p>'
    );
    setText('metricPlay', '');
    setText('metricAppstore', '');
    setText('aiNote', '');

    var highlightHead = d.querySelector('.highlight-head');
    if (highlightHead) highlightHead.style.display = 'none';
    var metrics = d.querySelector('.metrics');
    if (metrics) metrics.style.display = 'none';

    ['experience', 'skills', 'education'].forEach(function (id) {
      var sec = d.getElementById(id);
      if (sec) sec.style.display = 'none';
    });

    d.body.classList.add('silk-letter-mode');
    d.getElementById('langSwitch').textContent = lang === 'en' ? '中文' : 'English';
    var modeSwitch = d.querySelector('.mode-switch');
    if (modeSwitch) {
      modeSwitch.textContent = lang === 'en' ? 'Classic' : '普通版';
    }
    if (data.meta && data.meta.title) {
      d.title = data.meta.title + (lang === 'en' ? ' (Silk)' : '（丝绸版）');
    }
    if (data.meta && data.meta.lang) {
      d.documentElement.lang = data.meta.lang === 'en' ? 'en' : 'zh-CN';
    }
    setTimeout(function () {
      document.dispatchEvent(new CustomEvent('silk-content-ready'));
    }, 30);
  }

  function loadLang(lang, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/' + (lang === 'en' ? 'en' : 'zh') + '.json?v=' + encodeURIComponent(DATA_VERSION), true);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 400) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (e) {
          callback(e);
        }
      } else {
        callback(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () {
      callback(new Error('Network error'));
    };
    xhr.send();
  }

  function init() {
    var lang = getLang();
    var switchBtn = document.getElementById('langSwitch');
    switchBtn.addEventListener('click', function () {
      var next = lang === 'zh' ? 'en' : 'zh';
      setLang(next);
      loadLang(next, function (err, data) {
        if (!err) {
          lang = next;
          applyData(data);
        }
      });
    });

    loadLang(lang, function (err, data) {
      if (err) {
        if (lang !== 'zh') {
          loadLang('zh', function (e2, d2) {
            if (!e2) applyData(d2);
          });
        }
        return;
      }
      applyData(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
