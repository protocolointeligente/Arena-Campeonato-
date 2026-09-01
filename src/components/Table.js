import { esc } from '../app/utils.ts';

export function Table({ headers = [], rows = [], sortable = false, sortColumn, sortDirection = 'asc', onSort, rowKey = 'id', className = '', emptyMessage = 'Nenhum registro encontrado.', renderRow, striped = true, hoverable = true, responsive = true }) {
  const table = document.createElement('div');
  table.className = `table-wrapper ${className}`.trim();
  
  if (!rows.length) {
    table.innerHTML = `<div class="table-empty" role="status">${esc(emptyMessage)}</div>`;
    return table;
  }
  
  const wrapper = responsive ? document.createElement('div') : null;
  if (responsive) {wrapper.className = 'table-responsive';}
  
  const tableEl = document.createElement('table');
  tableEl.className = `data-table ${striped ? 'striped' : ''} ${hoverable ? 'hoverable' : ''}`;
  tableEl.setAttribute('role', 'grid');
  
  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.setAttribute('role', 'row');
  
  headers.forEach((header, index) => {
    const th = document.createElement('th');
    th.setAttribute('role', 'columnheader');
    th.setAttribute('scope', 'col');
    
    if (header.sortable && sortable) {
      const isSorted = sortColumn === header.key;
      const sortIcon = isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅';
      th.className = 'sortable';
      th.innerHTML = `
        <button type="button" class="sort-btn" data-sort-key="${esc(header.key)}" aria-sort="${isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}">
          ${esc(header.label)} <span class="sort-icon" aria-hidden="true">${sortIcon}</span>
        </button>
      `;
      th.querySelector('button').addEventListener('click', () => {
        if (onSort) {
          const newDirection = isSorted && sortDirection === 'asc' ? 'desc' : 'asc';
          onSort(header.key, newDirection);
        }
      });
    } else {
      th.textContent = header.label;
    }
    
    if (header.width) {th.style.width = header.width;}
    if (header.align) {th.style.textAlign = header.align;}
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  tableEl.appendChild(thead);
  
  // Body
  const tbody = document.createElement('tbody');
  
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    tr.setAttribute('data-row-key', esc(row[rowKey] ?? rowIndex));
    
    headers.forEach((header, colIndex) => {
      const td = document.createElement('td');
      td.setAttribute('role', 'gridcell');
      
      let cellContent;
      if (renderRow) {
        cellContent = renderRow(row, header.key, colIndex);
      } else if (header.render) {
        cellContent = header.render(row[header.key], row, colIndex);
      } else {
        cellContent = esc(row[header.key] ?? '');
      }
      
      if (typeof cellContent === 'string') {
        td.innerHTML = cellContent;
      } else if (cellContent instanceof Node) {
        td.appendChild(cellContent);
      }
      
      if (header.align) {td.style.textAlign = header.align;}
      if (header.width) {td.style.width = header.width;}
      
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
  
  tableEl.appendChild(tbody);
  
  if (responsive) {
    wrapper.appendChild(tableEl);
    table.appendChild(wrapper);
  } else {
    table.appendChild(tableEl);
  }
  
  return table;
}

export function TableSkeleton({ columns = 5, rows = 5 }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  
  const table = document.createElement('table');
  table.className = 'data-table skeleton';
  
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (let i = 0; i < columns; i++) {
    const th = document.createElement('th');
    th.innerHTML = '<div class="skeleton-loader"></div>';
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  for (let i = 0; i < rows; i++) {
    const tr = document.createElement('tr');
    for (let j = 0; j < columns; j++) {
      const td = document.createElement('td');
      td.innerHTML = '<div class="skeleton-loader"></div>';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  
  wrapper.appendChild(table);
  return wrapper;
}

