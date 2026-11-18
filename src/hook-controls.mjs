const states = {
  absent: '未安装',
  installed: '已安装',
  partial: '安装不完整',
  conflict: '配置冲突',
  unavailable: '不可用',
};

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

export function createHookControls(section, api) {
  const guidance = section.querySelector('#hook-guidance');
  if (!api) {
    guidance.textContent = '请在 Relay 桌面版中管理 Hook。';
    return () => {};
  }

  guidance.textContent = '只有点击安装、修复或移除才会更改本地 Hook 配置。如 Agent 要求信任或启用 Hook，请在该客户端确认。';
  const rows = section.querySelector('#hook-rows');
  const status = section.querySelector('#hook-status');
  const retry = section.querySelector('#hook-retry');
  let busy = false;

  function renderHook(hook) {
    const row = document.createElement('fieldset');
    row.dataset.hookId = hook.id;
    row.dataset.state = hook.state;
    row.tabIndex = -1;
    const state = element('span', states[hook.state] ?? states.unavailable);
    state.className = 'hook-state';
    const legend = element('legend', hook.label);
    legend.append(' · ', state);
    row.append(legend);
    if (hook.detail) row.append(element('p', hook.detail));
    if (hook.target) row.append(element('code', hook.target));
    function addButton(action, label) {
      const button = element('button', label);
      button.type = 'button';
      button.addEventListener('click', () => refresh(hook, action, label));
      row.append(button);
    }
    if (hook.state === 'absent') addButton('install', '安装');
    if (hook.state === 'partial') addButton('install', '修复');
    if (hook.state === 'installed' || hook.state === 'partial') addButton('remove', '移除');
    return row;
  }

  async function refresh(hook, action, label) {
    if (busy) return;
    busy = true;
    const restoreFocus = section.contains(document.activeElement);
    retry.hidden = true;
    for (const row of rows.children) row.disabled = true;
    rows.setAttribute('aria-busy', 'true');
    status.classList.remove('hook-error');
    status.textContent = hook ? `正在${label} ${hook.label}…` : '正在读取 Hook 状态…';
    const messages = [];
    try {
      if (hook) {
        try {
          await api[action](hook.id);
        } catch (error) {
          messages.push(`${hook.label} ${label}失败：${error?.message ?? error}`);
        }
      }
      const hooks = await api.list();
      rows.replaceChildren(...hooks.map(renderHook));
      if (!messages.length) {
        const updated = hook && hooks.find(item => item.id === hook.id);
        status.textContent = updated ? `${updated.label} · ${states[updated.state]}` :
          hooks.length ? '' : '没有可管理的 Hook。';
      }
    } catch (error) {
      rows.replaceChildren();
      retry.hidden = false;
      messages.push(`读取 Hook 状态失败：${error?.message ?? error}`);
    } finally {
      busy = false;
      rows.setAttribute('aria-busy', 'false');
      if (messages.length) {
        status.classList.add('hook-error');
        status.textContent = messages.join(' ');
      }
      if (restoreFocus && document.activeElement === document.body && section.closest('dialog').open) {
        const row = [...rows.children].find(item => item.dataset.hookId === hook?.id);
        const next = row?.querySelector('button') ?? row ?? section.querySelector('button:not([hidden])');
        next?.focus();
      }
    }
  }

  retry.addEventListener('click', () => refresh());
  return () => refresh();
}
