(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-6';
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

  function renderValueBullets(lines, isMobile) {
    if (!Array.isArray(lines)) return '';
    var limit = isMobile ? 2 : lines.length;
    return lines.slice(0, limit).map(function (line) {
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

  function renderProfileDetails(data, narrative, lang, isMobile) {
    var basics = data.basics || {};
    var contact = (basics && basics.contact) || {};
    var rows = [
      [lang === 'en' ? 'Profile' : '基本信息', [basics.genderAge, basics.location, basics.yearsExp].filter(Boolean).join(' · ')],
      [lang === 'en' ? 'Target' : '求职意向', narrative.targetRole],
      [lang === 'en' ? 'Summary' : '职业摘要', narrative.tagline],
      ['Tel', contact.phone || ''],
      ['Email', contact.email || '']
    ];
    if (!isMobile) rows.push(['WeChat', contact.wechat || '']);
    if (contact.resumeRepo) {
      rows.push([
        lang === 'en' ? 'Resume' : '简历',
        '<a href="' + escapeHtml(contact.resumeRepo) + '" target="_blank" rel="noopener noreferrer" class="contact-link">' + escapeHtml(contact.resumeRepo) + '</a>'
      ]);
    }
    return '<dl class="detail-grid">' + rows.map(function (row) {
      var value = row[1] || '';
      var htmlVal = value.indexOf('<a ') === 0 ? value : escapeHtml(value);
      return '<div class="detail-row"><dt class="detail-label">' + escapeHtml(row[0]) + '</dt><dd class="detail-value">' + htmlVal + '</dd></div>';
    }).join('') + '</dl>';
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
          ? 'AI Tech Lead / Engineering Manager'
          : 'AI Tech Lead / Engineering Manager (Delivery & Productivity)',
        tagline: shortMobile
          ? 'AI-assisted full-stack delivery.'
          : 'AI-assisted full-stack delivery leader who turns business goals into measurable product outcomes.',
        achievementTitle: 'Key Impact',
        achievementRole: shortMobile ? 'Tech Lead (AI + Full Stack)' : 'Tech Lead (AI + Full Stack Delivery)',
        products: shortMobile ? [
          'Cross-border procurement app, from design to release.'
        ] : (mobile ? [
          'Cross-border procurement app, led delivery from architecture to release.'
        ] : [
          'Led factory procurement and warehouse management app end-to-end delivery.',
          'Built cross-border purchase app and led release on major stores.'
        ]),
        metricPlay: shortMobile
          ? 'Google Play users grew steadily.'
          : 'Google Play: clear user growth with sustained trend.',
        metricAppstore: shortMobile
          ? 'App Store downloads improved steadily.'
          : 'App Store: cumulative downloads kept increasing.',
        aiNote: shortMobile
          ? 'AI tools integrated into daily engineering flow.'
          : 'Integrated Cursor and Claude into delivery workflow for speed and quality.',
        valueTitle: 'Leadership Value',
      valueBullets: shortMobile ? [
          'Business-first planning with stable milestone delivery.'
        ] : (mobile ? [
          'Business-first planning with stable milestone delivery.',
          'AI workflow integration to shorten release cycle and reduce rework.'
        ] : [
          'Business-first planning: convert goals into clear, deliverable milestones.',
          'AI workflow integration: accelerate delivery while keeping quality and engineering standards.'
        ]),
        skillsLead: shortMobile
          ? 'Stack: Flutter · Java · Node · Python · Cursor/Claude'
          : 'Stack: Flutter · Java · Node · Python · AI workflow (Cursor / Claude).',
        skillsDomain: shortMobile
          ? ''
          : (mobile ? 'Domains: IoT · e-commerce · IM.' : 'Domains: IoT · e-commerce · IM · enterprise systems.')
      };
    }
    return {
      targetRole: shortMobile
        ? 'AI 技术负责人 / 工程管理'
        : 'AI 技术负责人 / 工程管理（交付与效率）',
      tagline: shortMobile
        ? 'AI 辅助研发与全栈交付。'
        : 'AI 辅助研发与全栈交付负责人，擅长把复杂业务目标快速落地为可增长产品。',
      achievementTitle: '代表成果',
      achievementRole: shortMobile ? '技术负责人（AI + 全栈）' : '技术负责人（AI + 全栈交付）',
      products: shortMobile ? [
        '跨境采购 App，主导从方案到上线。'
      ] : (mobile ? [
        '跨境采购 App，主导从架构到上线交付。'
      ] : [
        '主导工厂采购与仓储管理 App 全链路交付。',
        '主导跨境采购 App 开发并完成双端发布。'
      ]),
      metricPlay: shortMobile
        ? 'Google Play 持续增长。'
        : 'Google Play：用户增长趋势稳定。',
      metricAppstore: shortMobile
        ? 'App Store 下载持续提升。'
        : 'App Store：累计下载持续提升。',
      aiNote: shortMobile
        ? '将 AI 工具融入日常研发流程。'
        : '将 Cursor / Claude 融入交付流程，兼顾效率与质量。',
      valueTitle: '管理价值',
      valueBullets: shortMobile ? [
        '业务导向拆解目标，稳定推进里程碑。'
      ] : (mobile ? [
        '业务导向拆解目标，稳定推进里程碑。',
        '把 AI 工具链融入研发流程，缩短交付周期并减少返工。'
      ] : [
        '业务导向：将目标拆解为可交付里程碑，保证节奏与质量。',
        '效率导向：将 AI 工具链融入研发流程，缩短交付周期并降低返工成本。'
      ]),
      skillsLead: shortMobile
        ? '技术栈：Flutter · Java · Node · Python · Cursor/Claude'
        : '技术栈：Flutter · Java · Node · Python · AI 工作流（Cursor / Claude）。',
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
    setText('basicsLine', '');
    setText('targetRole', '');
    setText('tagline', '');
    setHTML('contact', renderProfileDetails(data, narrative, lang, mobile));

    setText('highlightTitle', narrative.achievementTitle);
    setText('highlightCompany', compactText(highlight.company || '', lang, shortMobile ? 10 : (mobile ? 14 : 24), shortMobile ? 18 : (mobile ? 24 : 50)));
    setText('highlightPeriod', compactText(highlight.period || '', lang, shortMobile ? 8 : (mobile ? 10 : 20), shortMobile ? 14 : (mobile ? 20 : 34)));
    setText('highlightRole', narrative.achievementRole);
    setHTML('highlightProducts', renderProducts(narrative.products || highlight.products || [], lang, mobile, shortMobile));
    setText('metricPlay', narrative.metricPlay);
    setText('metricAppstore', narrative.metricAppstore);
    setText('aiNote', narrative.aiNote);

    setText('experienceTitle', narrative.valueTitle);
    setHTML('experienceList', renderValueBullets(narrative.valueBullets, mobile));

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
