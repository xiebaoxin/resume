(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-5';
  var DEFAULT_LANG = 'zh';

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function compactText(text, lang, maxZh, maxEn) {
    if (!text) return '';
    var clean = String(text).replace(/\s+/g, ' ').trim();
    var max = lang === 'en' ? maxEn : maxZh;
    if (clean.length <= max) return clean;
    return clean.slice(0, Math.max(1, max - 1)).trim() + '…';
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

  function renderContact(data, isMobile) {
    var contact = data.basics.contact || {};
    var parts = [];
    if (contact.phone) parts.push('<span>Tel: ' + escapeHtml(contact.phone) + '</span>');
    if (contact.email) parts.push('<span>Email: ' + escapeHtml(contact.email) + '</span>');
    if (!isMobile && contact.wechat) parts.push('<span>WeChat: ' + escapeHtml(contact.wechat) + '</span>');
    if (!isMobile && contact.resumeRepo && contact.resumeRepoLabel) {
      parts.push('<span>' + escapeHtml(contact.resumeRepoLabel) + '：<a href="' + escapeHtml(contact.resumeRepo) + '" target="_blank" rel="noopener noreferrer" class="contact-link">' + escapeHtml(contact.resumeRepo) + '</a></span>');
    }
    if (parts.length === 0 && contact.phone) parts.push('<span>Tel: ' + escapeHtml(contact.phone) + '</span>');
    return parts.join('');
  }

  function renderValueBullets(lines) {
    if (!Array.isArray(lines)) return '';
    return lines.map(function (line) {
      return '<li class="exp-item value-item"><p class="exp-item-summary">' + escapeHtml(line) + '</p></li>';
    }).join('');
  }

  function renderProducts(items, lang, isMobile, isShortMobile) {
    if (!Array.isArray(items)) return '';
    var limit = isShortMobile ? 1 : (isMobile ? 1 : 2);
    return items.slice(0, limit).map(function (p) {
      var text = (p.name || '') + ' ' + compactText(p.desc || '', lang, isShortMobile ? 12 : (isMobile ? 18 : 42), isShortMobile ? 20 : (isMobile ? 34 : 90));
      return '<div class="product">' + escapeHtml(text) + '</div>';
    }).join('');
  }

  function renderTech(tech, isMobile, isShortMobile) {
    if (!Array.isArray(tech)) return '';
    return tech.slice(0, isShortMobile ? 3 : (isMobile ? 4 : 10)).map(function (t) {
      return '<span class="tag">' + escapeHtml(t) + '</span>';
    }).join('');
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || '';
  }

  function setHTML(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value || '';
  }

  function buildNarrative(lang, mobile, shortMobile) {
    if (lang === 'en') {
      return {
        targetRole: shortMobile
          ? 'Target: AI Tech Lead / Engineering Manager'
          : 'Target: AI Tech Lead / Engineering Manager (Delivery & Productivity)',
        tagline: shortMobile
          ? 'AI-assisted full-stack delivery lead.'
          : 'AI-assisted full-stack delivery lead who turns complex business goals into shippable, measurable products.',
        achievementTitle: 'Key Impact',
        achievementRole: shortMobile ? 'Tech Lead (AI + Full Stack)' : 'Tech Lead (AI + Full Stack Delivery)',
        valueTitle: 'Leadership Value',
        valueBullets: shortMobile ? [
          'Business-first planning, stable milestone delivery.'
        ] : (mobile ? [
          'Business-first planning with stable milestone delivery.',
          'AI workflow integration to shorten release cycle and reduce rework.'
        ] : [
          'Business-first planning: convert goals into clear, deliverable milestones.',
          'AI workflow integration: accelerate delivery while keeping quality and engineering standards.',
          'Cross-functional execution: align product, engineering and operations for predictable outcomes.'
        ]),
        skillsLead: shortMobile
          ? 'Stack: Flutter · Java · Node · Python · Cursor/Claude'
          : 'Stack: Flutter · Java · Node · Python · AI coding workflow (Cursor / Claude).',
        skillsDomain: shortMobile
          ? ''
          : (mobile ? 'Domains: IoT · e-commerce · IM.' : 'Domains: IoT · e-commerce · IM · enterprise systems.')
      };
    }
    return {
      targetRole: shortMobile
        ? '求职意向：AI 技术负责人 / 工程管理'
        : '求职意向：AI 技术负责人 / 工程管理（交付与效率）',
      tagline: shortMobile
        ? 'AI 辅助研发与全栈交付负责人。'
        : 'AI 辅助研发与全栈交付负责人，擅长把复杂业务目标快速落地为可增长、可复用的产品。',
      achievementTitle: '代表成果',
      achievementRole: shortMobile ? '技术负责人（AI + 全栈）' : '技术负责人（AI + 全栈交付）',
      valueTitle: '管理价值',
      valueBullets: shortMobile ? [
        '业务导向拆解目标，稳定推进里程碑。'
      ] : (mobile ? [
        '业务导向拆解目标，稳定推进里程碑。',
        '把 AI 工具链融入研发流程，缩短交付周期并减少返工。'
      ] : [
        '业务导向：将目标拆解为可交付里程碑，保证节奏与质量。',
        '效率导向：将 AI 工具链融入研发流程，缩短交付周期并降低返工成本。',
        '协同导向：统一跨端与后端方案，提升跨团队协作效率。'
      ]),
      skillsLead: shortMobile
        ? '技术栈：Flutter · Java · Node · Python · Cursor/Claude'
        : '技术栈：Flutter · Java · Node · Python · AI 编码工作流（Cursor / Claude）。',
      skillsDomain: shortMobile
        ? ''
        : (mobile ? '领域：IoT · 电商 · IM。' : '领域：IoT · 电商 · IM · 企业系统。')
    };
  }

  function applyData(data) {
    var d = document;
    var lang = (data.meta && data.meta.lang) === 'en' ? 'en' : 'zh';
    var mobile = isMobileViewport();
    var shortMobile = mobile && window.innerHeight < 720;
    var narrative = buildNarrative(lang, mobile, shortMobile);
    var basics = data.basics || {};
    var highlight = data.highlight || {};
    var skills = data.skills || {};
    var education = data.education || {};

    setText('name', data.name || '');
    setText('basicsLine', [basics.genderAge, basics.location, basics.yearsExp].filter(Boolean).join(' · '));
    setText('targetRole', narrative.targetRole);
    setText('tagline', narrative.tagline);
    setHTML('contact', renderContact(data, mobile));

    setText('highlightTitle', narrative.achievementTitle);
    setText('highlightCompany', compactText(highlight.company || '', lang, shortMobile ? 10 : (mobile ? 14 : 24), shortMobile ? 18 : (mobile ? 24 : 50)));
    setText('highlightPeriod', compactText(highlight.period || '', lang, shortMobile ? 8 : (mobile ? 10 : 20), shortMobile ? 14 : (mobile ? 20 : 34)));
    setText('highlightRole', narrative.achievementRole);
    setHTML('highlightProducts', renderProducts(highlight.products || [], lang, mobile, shortMobile));
    setText('metricPlay', compactText((highlight.metrics && highlight.metrics.play) || '', lang, shortMobile ? 12 : (mobile ? 16 : 34), shortMobile ? 20 : (mobile ? 28 : 72)));
    setText('metricAppstore', compactText((highlight.metrics && highlight.metrics.appstore) || '', lang, shortMobile ? 12 : (mobile ? 16 : 34), shortMobile ? 20 : (mobile ? 28 : 72)));
    setText('aiNote', compactText(highlight.aiNote || '', lang, shortMobile ? 10 : (mobile ? 14 : 24), shortMobile ? 18 : (mobile ? 28 : 56)));

    setText('experienceTitle', narrative.valueTitle);
    setHTML('experienceList', renderValueBullets(narrative.valueBullets));

    setText('skillsTitle', skills.title || '');
    setText('skillsLead', narrative.skillsLead);
    setHTML('skillsTech', renderTech(skills.tech || [], mobile, shortMobile));
    setText('skillsDomain', narrative.skillsDomain);

    setText('educationTitle', education.title || '');
    setText('educationContent', [
      education.school,
      education.degree,
      education.major,
      education.period
    ].filter(Boolean).join(' · '));

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
