import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const css = readFileSync(
  new URL('../app/globals.css', import.meta.url),
  'utf8',
).replace(/^@import[^;]+;/gm, '');

// A DOM/CSS regression check, not a browser geometry or screenshot test.
// The failure occurred only after navigation items moved into <details>.
test('nested register navigation retains row layout and a non-overlapping footer', () => {
  const window = new Window({ width: 1440, height: 900 });
  const style = window.document.createElement('style');
  style.textContent = css;
  window.document.head.append(style);
  window.document.body.innerHTML = `
    <aside class="side">
      <nav class="side-navigation">
        <button class="side-nav-item active"><span>My work</span></button>
        <details class="more-nav" open>
          <summary>More tools and registers</summary>
          <a class="side-tools-link">More role tools <span>→</span></a>
          <button class="side-nav-item active"><svg></svg><span>Data governance and audit</span><em>11</em></button>
        </details>
      </nav>
      <div class="side-help">District MIS Cell</div>
    </aside>`;
  const computed = (selector: string) =>
    window.getComputedStyle(window.document.querySelector(selector)!);
  assert.equal(computed('.more-nav .side-nav-item').display, 'flex');
  assert.equal(computed('.more-nav .side-nav-item').width, '100%');
  assert.equal(computed('.more-nav .side-nav-item').alignItems, 'center');
  assert.equal(computed('.more-nav .side-nav-item > svg').flexShrink, '0');
  assert.equal(computed('.more-nav .side-nav-item > span').minWidth, '0');
  assert.equal(computed('.side-tools-link').display, 'flex');
  assert.equal(computed('.side-help').position, 'static');
  assert.equal(computed('.side-navigation').overflowY, 'auto');
  window.close();
});

test('role workspace links use a full-width row at both navigation depths', () => {
  const window = new Window({ width: 1440, height: 900 });
  const style = window.document.createElement('style');
  style.textContent = css;
  window.document.head.append(style);
  window.document.body.innerHTML = `
    <aside class="suite-launcher">
      <button class="suite-nav-item active"><span><strong>My work</strong></span></button>
      <details class="more-nav" open><summary>More tools</summary>
        <button class="suite-nav-item active">Infrastructure and safety</button>
      </details>
    </aside>`;
  for (const item of window.document.querySelectorAll('.suite-nav-item')) {
    const computed = window.getComputedStyle(item);
    assert.equal(computed.display, 'flex');
    assert.equal(computed.width, '100%');
    assert.equal(computed.borderLeftColor, '#17365d');
  }
  window.close();
});
