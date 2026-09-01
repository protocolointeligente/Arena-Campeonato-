import { esc } from '../../../app/utils.ts';

export function renderCategories(store) {
  const state = store.getState();
  return `
    <div class="card">
      <div class="actions" style="justify-content:space-between">
        <div><h2>Categorias</h2><p class="muted">Separe atletas e jogos por categoria (ex.: sub-15, feminino).</p></div>
        <button class="btn primary" data-add-category>+ Adicionar categoria</button>
      </div>
      <div style="margin-top:18px">
        ${state.categories.map((category) => `
          <div class="team-row">
            <span>${category.id === state.activeCategoryId ? '★' : ''}</span>
            <input data-category-name="${esc(category.id)}" value="${esc(category.nome)}">
            ${state.categories.length > 1 ? `<button class="btn ghost" data-remove-category="${esc(category.id)}">Remover</button>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

