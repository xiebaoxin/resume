(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-11';
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
        title: 'Recommendation',
        p1: mobile
          ? 'I recommend Xie Baoxin for senior technical management interviews. He translates complex business goals into executable plans, drives cross-functional delivery with strong ownership, and consistently lands measurable outcomes with both speed and quality.'
          : 'I recommend Xie Baoxin as a high-confidence candidate for senior technical management roles. He translates complex business goals into executable plans, drives cross-functional delivery with strong ownership, and consistently lands measurable outcomes with both speed and quality.',
        p2: ''
      };
    }
    return {
      targetRole: 'AI 技术负责人 / 工程管理',
      tagline: 'AI 辅助研发与全栈交付负责人。',
      title: '推荐意见',
      p1: mobile
        ? '建议将谢宝新列为高级技术管理岗优先面试人选：他能把复杂业务目标快速拆解为可执行计划，推动跨团队高效协同，并在效率与质量兼顾的前提下持续交付可量化结果。'
        : '建议将谢宝新列为高级技术管理岗优先面试人选：他能把复杂业务目标快速拆解为可执行计划，推动跨团队高效协同，并在效率与质量兼顾的前提下持续交付可量化结果。',
      p2: ''
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
    setText('highlightCompany', '');
    setText('highlightPeriod', '');
    setText('highlightRole', '');
    setHTML(
      'highlightProducts',
      '<p class="letter-paragraph">' + escapeHtml(narrative.p1) + '</p>' +
      (narrative.p2 ? '<p class="letter-paragraph">' + escapeHtml(narrative.p2) + '</p>' : '')
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
    document.body.classList.add('silk-letter-mode');
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
