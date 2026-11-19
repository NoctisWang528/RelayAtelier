async function requestSettings(options) {
  const response = await fetch('/api/sources', options);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error ?? '无法读取或保存来源设置。');
  }
  return response.json();
}
const webApi = {
  list: () => requestSettings(),
  save: (id, value) => requestSettings({ method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...value }) }),
};

export function createSourceControls(form, api = webApi) {
  const { agent, enabled, directories } = form.elements;
  const fieldset = form.querySelector('fieldset');
  const defaults = form.querySelector('code');
  const status = form.querySelector('[role="status"]');
  const pick = form.querySelector('[data-pick]');
  let rows = [], loading = false;
  const paths = () => directories.value.split('\n').map(path => path.trim()).filter(Boolean);
  function select() {
    const row = rows.find(row => row.id === agent.value);
    enabled.checked = row.enabled;
    directories.value = row.directories.join('\n');
    defaults.textContent = row.defaults.join('\n') || '未配置默认目录';
    status.textContent = '';
  }
  agent.addEventListener('change', select);
  pick.hidden = !api.pick;
  pick.addEventListener('click', async () => {
    const id = agent.value;
    try {
      const selected = await api.pick();
      if (agent.value === id && selected.length) directories.value = [...new Set([...paths(), ...selected])].join('\n');
    } catch { status.textContent = '无法打开目录选择器，可直接填写路径。'; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (fieldset.disabled) return;
    const value = { enabled: enabled.checked, directories: paths() };
    fieldset.disabled = true;
    try {
      rows = await api.save(agent.value, value);
      select();
      status.textContent = '已保存，监听设置已生效。';
    } catch (error) { status.textContent = error.message; }
    finally { fieldset.disabled = false; }
  });
  return async () => {
    if (loading || (rows.length && fieldset.disabled)) return;
    loading = fieldset.disabled = true;
    try {
      rows = await api.list();
      const previous = agent.value;
      agent.replaceChildren(...rows.map(row => new Option(row.label, row.id)));
      if (rows.some(row => row.id === previous)) agent.value = previous;
      select();
    } catch (error) { status.textContent = error.message; }
    finally { loading = false; fieldset.disabled = !rows.length; }
  };
}
