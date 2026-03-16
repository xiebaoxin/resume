(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-14';
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
        targetRole: 'AI Tech Lead / Engineering Manager',
        tagline: 'AI-assisted full-stack delivery and technical management leader.',
        title: 'Recommendation',
        p1: mobile
          ? 'I strongly recommend Xie Baoxin for senior technical management interviews. He converts complex business goals into clear milestones, aligns product, engineering, QA, and operations around execution, and consistently delivers measurable outcomes with both speed and quality.'
          : 'I strongly recommend Xie Baoxin as a high-confidence candidate for senior technical management roles. He converts complex business goals into clear milestones, aligns product, engineering, QA, and operations around execution, and consistently delivers measurable outcomes with both speed and quality while maintaining delivery predictability.',
        p2: mobile
          ? 'His standout value is the combination of AI-assisted engineering and end-to-end full-stack execution. He effectively applies tools such as Cursor and Claude to raise team productivity, and can independently drive delivery across Flutter, backend systems, and IoT/e-commerce/IM scenarios.'
          : 'His standout value is the combination of AI-assisted engineering and end-to-end full-stack execution. He effectively applies tools such as Cursor and Claude to raise team productivity, and can independently drive delivery across Flutter clients, backend architecture, and IoT/e-commerce/IM scenarios. He is also strong at mentoring engineers, setting technical standards, and ensuring technical decisions remain tightly linked to business value.',
      };
    }
    return {
      targetRole: 'AI 技术负责人 / 工程管理',
      tagline: 'AI 辅助研发、全栈交付与团队管理负责人。',
      title: '推荐意见',
      p1: mobile
        ? '建议将谢宝新列为高级技术管理岗优先面试人选。他能将复杂业务目标拆解为清晰里程碑，组织产品、研发、测试与运营高效协同，在兼顾效率与质量的前提下稳定产出可量化结果。'
        : '建议将谢宝新列为高级技术管理岗优先面试人选。他能将复杂业务目标拆解为清晰里程碑，组织产品、研发、测试与运营高效协同，在兼顾效率与质量的前提下稳定产出可量化结果，并持续提升团队交付确定性。',
      p2: mobile
        ? '其核心优势是“AI 辅助研发 + 全栈落地”双能力：熟练使用 Cursor、Claude 等工具提升团队产能，能够从 Flutter 客户端到后端架构，再到 IoT / 电商 / IM 场景完成端到端交付。'
        : '其核心优势是“AI 辅助研发 + 全栈落地”双能力：熟练使用 Cursor、Claude 等工具提升团队产能，能够从 Flutter 客户端到后端架构，再到 IoT / 电商 / IM 场景完成端到端交付。同时，他在工程规范建设、人才培养与技术决策方面表现稳定，能将技术路线与业务目标持续对齐。',
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
    setHTML('contact', renderContactLine(data, lang, mobile));

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
