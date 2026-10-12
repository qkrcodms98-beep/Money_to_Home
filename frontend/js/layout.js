// 헤더를 그린다. 모든 화면이 같은 헤더를 쓴다 (FR-COMMON-04).
//
// HTML에 <header id="header"></header>를 두면 이 파일이 안을 채운다.
// 로그인과 로그아웃은 2차에 이 파일에 붙인다.

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
