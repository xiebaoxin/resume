(function () {
  const LANG_KEY = 'resume-lang';
  const DEFAULT_LANG = 'zh';
  const DATA_VERSION = '20260311-1';

  function getLang() {
    const hash = (window.location.hash || '').toLowerCase();
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

  function copyText(text, buttonEl) {
    const label = buttonEl && buttonEl.getAttribute('data-copy-label');
    const doneLabel = buttonEl && buttonEl.getAttribute('data-copied-label');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          if (buttonEl && doneLabel) {
            buttonEl.textContent = doneLabel;
            setTimeout(function () {
              buttonEl.textContent = label || 'Copy';
            }, 1500);
          }
        },
        function () {
          fallbackCopy(text, buttonEl, label, doneLabel);
        }
      );
    } else {
      fallbackCopy(text, buttonEl, label, doneLabel);
    }
  }

  function fallbackCopy(text, buttonEl, label, doneLabel) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (buttonEl && doneLabel) {
        buttonEl.textContent = doneLabel;
        setTimeout(function () {
          buttonEl.textContent = label || 'Copy';
        }, 1500);
      }
    } catch (_) {}
    document.body.removeChild(ta);
  }

  function renderContact(data, ui) {
    const contact = data.basics.contact;
    const copyLabel = ui.copy || 'Copy';
    const copiedLabel = ui.copied || 'Copied';
    const parts = [
      '<span>Tel: <button type="button" class="btn-copy" data-copy-label="' + escapeHtml(copyLabel) + '" data-copied-label="' + escapeHtml(copiedLabel) + '" data-value="' + escapeHtml(contact.phone) + '">' + escapeHtml(contact.phone) + '</button></span>',
      '<span>Email: <button type="button" class="btn-copy" data-copy-label="' + escapeHtml(copyLabel) + '" data-copied-label="' + escapeHtml(copiedLabel) + '" data-value="' + escapeHtml(contact.email) + '">' + escapeHtml(contact.email) + '</button></span>',
      '<span>WeChat: ' + escapeHtml(contact.wechat) + '</span>'
    ];
    if (contact.resumeRepo && contact.resumeRepoLabel) {
      parts.push('<span>' + escapeHtml(contact.resumeRepoLabel) + '：<a href="' + escapeHtml(contact.resumeRepo) + '" target="_blank" rel="noopener noreferrer" class="contact-link">' + escapeHtml(contact.resumeRepo) + '</a></span>');
    }
    return parts.join('');
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderExperience(items) {
    return items
      .map(
        function (item) {
          return (
            '<li class="exp-item">' +
            '<div class="exp-item-head">' +
            '<span class="exp-item-company">' + escapeHtml(item.company) + '</span>' +
            '<span class="exp-item-period">' + escapeHtml(item.period) + '</span>' +
            '</div>' +
            '<div class="exp-item-role">' + escapeHtml(item.role) + '</div>' +
            '<p class="exp-item-summary">' + escapeHtml(item.summary) + '</p>' +
            '</li>'
          );
        }
      )
      .join('');
  }

  function renderProducts(products) {
    return products
      .map(
        function (p) {
          return '<div class="product"><strong>' + escapeHtml(p.name) + '</strong> ' + escapeHtml(p.desc) + '</div>';
        }
      )
      .join('');
  }

  function renderTech(tech) {
    if (!Array.isArray(tech)) return '';
    return tech.map(function (t) {
      return '<span class="tag">' + escapeHtml(t) + '</span>';
    }).join('');
  }

  function applyData(data) {
    var d = document;
    var basics = data.basics;
    var highlight = data.highlight;
    var experience = data.experience;
    var skills = data.skills;
    var education = data.education;
    var ui = data.ui || {};
    var charts = data.charts || {};

    d.getElementById('name').textContent = data.name;
    d.getElementById('basicsLine').textContent = [basics.genderAge, basics.location, basics.yearsExp].filter(Boolean).join(' · ');
    d.getElementById('targetRole').textContent = basics.targetRole;
    d.getElementById('tagline').textContent = basics.tagline;
    d.getElementById('contact').innerHTML = renderContact(data, ui);

    d.getElementById('highlightTitle').textContent = highlight.title;
    d.getElementById('highlightCompany').textContent = highlight.company;
    d.getElementById('highlightPeriod').textContent = highlight.period;
    d.getElementById('highlightRole').textContent = highlight.role;
    d.getElementById('highlightProducts').innerHTML = renderProducts(highlight.products);
    d.getElementById('metricPlay').textContent = highlight.metrics.play;
    d.getElementById('metricAppstore').textContent = highlight.metrics.appstore;
    d.getElementById('chartPlayLabel').textContent = charts.playLabel || '';
    d.getElementById('chartAppstoreLabel').textContent = charts.appstoreLabel || '';
    d.getElementById('aiNote').textContent = highlight.aiNote;

    d.getElementById('experienceTitle').textContent = experience.title;
    d.getElementById('experienceList').innerHTML = renderExperience(experience.items);

    d.getElementById('skillsTitle').textContent = skills.title;
    d.getElementById('skillsLead').textContent = skills.lead;
    d.getElementById('skillsTech').innerHTML = renderTech(skills.tech);
    d.getElementById('skillsDomain').textContent = skills.domain;

    d.getElementById('educationTitle').textContent = education.title;
    d.getElementById('educationContent').textContent = [
      education.school,
      education.degree,
      education.major,
      education.period
    ].filter(Boolean).join(' · ');

    var att = data.attachments;
    if (att && att.links && att.links.length) {
      var baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
      d.getElementById('attachmentsTitle').textContent = att.title || 'Attachments';
      d.getElementById('attachmentsLinks').innerHTML = att.links.map(function (link) {
        var fullHref = link.href.indexOf('http') === 0 ? link.href : (baseUrl + link.href);
        return '<span class="attachment-item">' + escapeHtml(link.label) + '：<a href="' + escapeHtml(fullHref) + '" class="attachment-link">' + escapeHtml(fullHref) + '</a></span>';
      }).join('');
    }

    d.getElementById('langSwitch').textContent = ui.langSwitch || 'English';
    if (data.meta && data.meta.title) {
      d.title = data.meta.title;
    }
    if (data.meta && data.meta.lang) {
      d.documentElement.lang = data.meta.lang === 'en' ? 'en' : 'zh-CN';
    }

    [].slice.call(d.querySelectorAll('.btn-copy')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = this.getAttribute('data-value');
        if (val) copyText(val, this);
      });
    });
  }

  function loadLang(lang, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/' + (lang === 'en' ? 'en' : 'zh') + '.json?v=' + encodeURIComponent(DATA_VERSION), true);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 400) {
        try {
          var data = JSON.parse(xhr.responseText);
          callback(null, data);
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
