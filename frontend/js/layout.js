// 화면의 공통 틀을 그린다 (FR-COMMON-04).
//
// 모바일에는 헤더가 없다 (확정 목업 v3). 그래서 지금은 그릴 것이 없다.
// HTML에 <header id="header"></header>가 있을 때만 아래가 동작한다. 웹 배치의 틀이 정해지면 여기에 둔다.

function renderHeader() {
  const header = document.getElementById('header');
  if (!header) return;

  const home = document.createElement('a');
  home.className = 'header__home';
  home.href = 'index.html';
  home.textContent = '머니 to 홈';

  header.classList.add('header');
  header.replaceChildren(home);
}

document.addEventListener('DOMContentLoaded', renderHeader);
