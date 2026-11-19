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

export function createSourceControls(section, api = webApi) {
  const form = section.querySelector('form');
  const { agent, directories } = form.elements;
  const fieldset = form.querySelector('fieldset');
  const defaults = form.querySelector('code');
  const status = form.querySelector('[role="status"]');
  const pick = form.querySelector('[data-pick]');
  const checks = section.querySelector('#agent-checks');
  const collectionStatus = section.querySelector('[data-collection-status]');
  let rows = [], loading = false, pending = 0;
  const paths = () => directories.value.split('\n').map(path => path.trim()).filter(Boolean);
  function select() {
    const row = rows.find(row => row.id === agent.value);
    directories.value = row.directories.join('\n');
    defaults.textContent = row.defaults.join('\n') || '未配置默认目录';
    status.textContent = '';
  }
  function checkbox(row) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = row.enabled;
    input.addEventListener('change', async () => {
      pending++;
      input.disabled = true;
      try {
        await api.save(row.id, { enabled: input.checked });
        collectionStatus.textContent = `${row.label} 已${input.checked ? '开启' : '关闭'}采集。`;
      } catch (error) {
        input.checked = !input.checked;
        collectionStatus.textContent = row.label + '：' + error.message;
      } finally {
        input.disabled = false;
        pending--;
      }
    });
    label.append(input, row.label);
    return label;
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
    pending++;
    fieldset.disabled = true;
    try {
      const saved = await api.save(agent.value, { directories: paths() });
      const row = rows.find(row => row.id === agent.value);
      row.directories = saved.find(item => item.id === row.id).directories;
      select();
      status.textContent = '目录已保存。';
    } catch (error) { status.textContent = error.message; }
    finally { fieldset.disabled = false; pending--; }
  });
  return async () => {
    if (loading || pending) return;
    loading = fieldset.disabled = true;
    checks.replaceChildren();
    collectionStatus.textContent = '正在读取采集设置…';
    try {
      rows = await api.list();
      const previous = agent.value;
      agent.replaceChildren(...rows.map(row => new Option(row.label, row.id)));
      if (rows.some(row => row.id === previous)) agent.value = previous;
      checks.replaceChildren(...rows.map(checkbox));
      select();
      collectionStatus.textContent = '';
      fieldset.disabled = false;
    } catch (error) { collectionStatus.textContent = error.message; }
    finally { loading = false; }
  };
}
