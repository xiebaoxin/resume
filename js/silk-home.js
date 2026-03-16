(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-16';
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

  function renderContactLine(data, lang, mobile) {
    var basics = data.basics || {};
    var contact = basics.contact || {};
    var education = data.education || {};
    var skills = data.skills || {};
    var tech = Array.isArray(skills.tech) ? skills.tech.slice(0, mobile ? 3 : 5) : [];
    var lines = [];

    function pushLine(items) {
      if (items.length) lines.push(items.join('  ·  '));
    }

    if (lang === 'en') {
      var line1 = [];
      if (contact.phone) line1.push('Tel: ' + contact.phone);
      if (contact.email) line1.push('Email: ' + contact.email);
      if (basics.location) line1.push('Location: ' + basics.location);
      pushLine(line1);

      var line2 = [];
      if (basics.yearsExp) line2.push('Experience: ' + basics.yearsExp);
      if (contact.wechat) line2.push('WeChat: ' + contact.wechat);
      if (contact.resumeRepo) line2.push('Resume: ' + contact.resumeRepo);
      pushLine(line2);

      if (!mobile) {
        var line3 = [];
        var edu = [education.degree, education.school].filter(Boolean).join(' · ');
        if (edu) line3.push('Education: ' + edu);
        if (tech.length) line3.push('Stack: ' + tech.join(' / '));
        pushLine(line3);
      }
    } else {
      var zhLine1 = [];
      if (contact.phone) zhLine1.push('电话：' + contact.phone);
      if (contact.email) zhLine1.push('邮箱：' + contact.email);
      if (basics.location) zhLine1.push('城市：' + basics.location);
      pushLine(zhLine1);

      var zhLine2 = [];
      if (basics.yearsExp) zhLine2.push('经验：' + basics.yearsExp);
      if (contact.wechat) zhLine2.push('微信：' + contact.wechat);
      if (contact.resumeRepo) zhLine2.push('简历：' + contact.resumeRepo);
      pushLine(zhLine2);

      if (!mobile) {
        var zhLine3 = [];
        var zhEdu = [education.school, education.degree].filter(Boolean).join(' · ');
        if (zhEdu) zhLine3.push('学历：' + zhEdu);
        if (tech.length) zhLine3.push('技术栈：' + tech.join(' / '));
        pushLine(zhLine3);
      }
    }

    return lines.map(function (line) {
      return '<p class="letter-contact">' + escapeHtml(line) + '</p>';
    }).join('');
  }

  function buildNarrative(lang, mobile) {
    if (lang === 'en') {
      return {
        targetRole: '',
        tagline: '',
        title: 'Personal Pitch',
        p1: mobile
          ? 'I focus on AI-assisted engineering management and full-stack delivery. I can rapidly convert business goals into executable milestones, coordinate cross-functional collaboration, and keep delivery speed and quality in balance to produce measurable outcomes.'
          : 'I focus on AI-assisted engineering management and full-stack delivery. I can rapidly convert business goals into executable milestones, coordinate product, engineering, QA, and operations teams efficiently, and keep delivery speed and quality in balance to produce measurable outcomes.',
        p2: mobile
          ? 'My core advantage is the combination of AI productivity and end-to-end execution. I use tools like Cursor and Claude to improve team throughput, and can independently deliver Flutter clients, backend systems, and IoT / e-commerce / IM projects from architecture to production.'
          : 'My core advantage is the combination of AI productivity and end-to-end execution. I use tools like Cursor and Claude to improve team throughput, and can independently deliver Flutter clients, backend systems, and IoT / e-commerce / IM projects from architecture to production. I also build engineering standards and team workflows that keep technical decisions aligned with business value.',
      };
    }
    return {
      targetRole: '',
      tagline: '',
      title: '个人推介',
      p1: mobile
        ? '我聚焦 AI 辅助研发管理与全栈交付，能够将复杂业务目标快速拆解为可执行里程碑，推动跨团队高效协同，在效率与质量并重的前提下持续交付可量化结果。'
        : '我聚焦 AI 辅助研发管理与全栈交付，能够将复杂业务目标快速拆解为可执行里程碑，组织产品、研发、测试、运营高效协同，在效率与质量并重的前提下持续交付可量化结果。',
      p2: mobile
        ? '我的核心优势是“AI 提效 + 端到端落地”双能力：熟练运用 Cursor、Claude 等工具提升团队产能，可独立完成 Flutter 客户端、后端系统及 IoT / 电商 / IM 场景的全链路交付。'
        : '我的核心优势是“AI 提效 + 端到端落地”双能力：熟练运用 Cursor、Claude 等工具提升团队产能，可独立完成 Flutter 客户端、后端系统及 IoT / 电商 / IM 场景的全链路交付。同时，我持续推动工程规范、团队协作机制与技术决策体系建设，让技术投入稳定转化为业务价值。',
    };
  }

  function applyData(data) {
    var d = document;
    var lang = (data.meta && data.meta.lang) === 'en' ? 'en' : 'zh';
    var mobile = isMobileViewport();
    var narrative = buildNarrative(lang, mobile);

    setText('name', data.name || '');
    setText('basicsLine', '');
    setText('targetRole', narrative.targetRole);
    setText('tagline', narrative.tagline);
    setHTML('contact', '');

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
