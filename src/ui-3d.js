import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export function createSectionLabel(section) {
    const div = document.createElement('div');
    div.className = 'section-label';
    div.innerHTML = `
        <span class="section-name">Section ${section.id}</span>
        <div class="hp-bar-3d"><div class="hp-fill-3d" style="width:100%"></div></div>
        <span class="hp-pct">100%</span>
    `;

    const label = new CSS2DObject(div);
    label.position.set(0, 10, 2);  // above the wall top (~5 units), slightly in front toward camera
    section.group.add(label);
    section.label = label;
}

export function updateLabel(section) {
    if (!section.label) return;
    const pct  = section.breached ? 0 : (section.hp / section.maxHp) * 100;
    const fill = section.label.element.querySelector('.hp-fill-3d');
    const text = section.label.element.querySelector('.hp-pct');

    fill.style.width = pct + '%';
    fill.style.backgroundColor =
        section.breached ? '#ffd700' :
        pct > 60         ? '#4caf50' :
        pct > 30         ? '#ff9800' : '#f44336';

    text.textContent = section.breached ? 'BREACHED' : Math.ceil(pct) + '%';
}
