const repo = 'NoctisWang528/RelayAtelier';
const releasesURL = 'https://github.com/' + repo + '/releases';

function versionParts(version) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error('发行标签无效');
  return match.slice(1).map(BigInt);
}

async function latestRelease(current, fetchRelease = fetch) {
  const response = await fetchRelease('https://api.github.com/repos/' + repo + '/releases/latest', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Relay-Atelier' },
    credentials: 'omit', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('GitHub HTTP ' + response.status);
  const release = await response.json();
  if (release.draft || release.prerelease) throw new Error('没有正式发行版');
  const local = versionParts(current), latest = versionParts(release.tag_name);
  const changed = latest.findIndex((part, i) => part !== local[i]);
  return { tag: release.tag_name, newer: changed >= 0 && latest[changed] > local[changed],
    url: releasesURL + '/tag/' + release.tag_name };
}

function createUpdateChecker({ current, dialog, shell, getWindow, fetchRelease }) {
  let pending, manualCheck = false, alreadyShown;
  return function check(manual = false) {
    manualCheck ||= manual;
    if (pending) return pending;
    pending = (async () => {
      let release;
      try { release = await latestRelease(current, fetchRelease); }
      catch { if (manualCheck && getWindow()) await dialog.showMessageBox(getWindow(), {
        type: 'warning', message: '暂时无法检查更新', detail: '请检查网络连接，稍后再试。'
      }); return; }
      const win = getWindow();
      if (!win || win.isDestroyed()) return;
      if (release.newer && (manualCheck || alreadyShown !== release.tag)) {
        alreadyShown = release.tag;
        const answer = await dialog.showMessageBox(win, { type: 'info',
          message: '发现新版 Relay Atelier ' + release.tag, detail: '当前公开版本 v' + current,
          buttons: ['查看发行页面', '稍后'], defaultId: 0, cancelId: 1 });
        if (answer.response === 0) await shell.openExternal(release.url);
      } else if (manualCheck) {
        await dialog.showMessageBox(win, { type: 'info', message: '已是最新版本', detail: '当前公开版本 v' + current });
      }
    })().finally(() => { pending = null; manualCheck = false; });
    return pending;
  };
}

module.exports = { latestRelease, createUpdateChecker };
