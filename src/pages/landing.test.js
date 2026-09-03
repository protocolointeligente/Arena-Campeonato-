// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderLanding } from './landing.js';
import { PLAN_DEFINITIONS } from '../app/plans.js';
import { MODALITIES } from '../app/templates.js';

beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

describe('renderLanding — header', () => {
  it('tem nav com âncoras pras seções e os dois CTAs principais', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const nav = [...root.querySelectorAll('nav a, nav button')].map((el) => el.textContent.trim());
    expect(nav.some((t) => /recursos/i.test(t))).toBe(true);
    expect(nav.some((t) => /modalidades/i.test(t))).toBe(true);
    expect(nav.some((t) => /como funciona/i.test(t))).toBe(true);
    expect(nav.some((t) => /planos/i.test(t))).toBe(true);
    expect(root.querySelector('[data-route="/login"]')).not.toBeNull();
    expect(root.querySelector('.landing-nav [data-route="/register"]').textContent).toMatch(/CRIAR CAMPEONATO GRÁTIS/i);
  });
});

describe('renderLanding — hero', () => {
  it('tem o H1, subheadline e os dois CTAs do hero', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const h1 = root.querySelector('.hero h1').textContent;
    expect(h1).toMatch(/Todos os seus campeonatos/i);
    expect(h1).toMatch(/Arena/i);
    expect(root.querySelector('.hero [data-route="/register"]')).not.toBeNull();
    expect(root.querySelector('.hero [data-route="/demo"]').textContent).toMatch(/VER DEMONSTRAÇÃO/i);
  });

  it('mostra o produto real (screenshot capturado) dentro de uma moldura de dispositivo', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const img = root.querySelector('.hero .device-frame img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/landing/dashboard.png');
    expect(img.alt).not.toBe('');
  });
});

describe('renderLanding — faixa de modalidades', () => {
  it('usa o texto do spec e mostra o total real de modalidades', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    expect(root.textContent).toMatch(/UMA ARENA PARA CADA ESPORTE/i);
    expect(root.querySelector('.sport-chip-more').textContent).toMatch(/dezenas de modalidades/i);
  });
});

describe('renderLanding — problema→solução', () => {
  it('lista os pontos das duas colunas', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const text = root.textContent;
    expect(text).toMatch(/planilha infinita/i);
    expect(text).toMatch(/WhatsApp/i);
    expect(text).toMatch(/classificação automática/i);
    expect(text).toMatch(/QR Code/i);
  });
});

describe('renderLanding — funcionalidades', () => {
  it('grid de funcionalidades tem 6 cards com imagem real', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const cards = root.querySelectorAll('.feature-card');
    expect(cards.length).toBe(6);
    const imgs = root.querySelectorAll('.feature-card img[loading="lazy"]');
    expect(imgs.length).toBe(6);
    [...imgs].forEach((img) => expect(img.alt).not.toBe(''));
  });
});

describe('renderLanding — formatos de competição', () => {
  it('mostra liga, grupos, mata-mata e ranking', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const text = root.textContent;
    ['Liga', 'Grupos', 'Mata-mata', 'Ranking'].forEach((label) => expect(text).toMatch(new RegExp(label, 'i')));
  });
});

describe('renderLanding — como funciona', () => {
  it('tem os 8 passos na ordem certa', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const steps = [...root.querySelectorAll('#como-funciona .timeline-step h3')].map((el) => el.textContent);
    expect(steps).toEqual([
      'Crie sua conta', 'Escolha a modalidade', 'Configure o formato', 'Cadastre ou convide participantes',
      'Gere jogos e fases', 'Publique o campeonato', 'Atualize resultados', 'Finalize e compartilhe os campeões',
    ]);
  });
});

describe('renderLanding — números e planos', () => {
  it('mostra só números verificáveis (sem estatística inventada)', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    expect(root.textContent).toMatch(new RegExp(`${Object.keys(MODALITIES).length}`));
    expect(root.textContent).toMatch(/MODALIDADES CONFIGURADAS/i);
    expect(root.textContent).not.toMatch(/\d[\d.,]*\s*(campeonatos criados|atletas cadastrados|usuários ativos)/i);
  });

  it('renderiza um card por plano real de PLAN_DEFINITIONS, com o preço certo', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const cards = root.querySelectorAll('.price-card');
    expect(cards.length).toBe(Object.keys(PLAN_DEFINITIONS).length);
    expect(root.textContent).toMatch(/R\$\s*25,00/);
  });

  it('tabela comparativa tem uma coluna por plano', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const headerCols = root.querySelectorAll('.plan-compare thead th');
    expect(headerCols.length).toBe(Object.keys(PLAN_DEFINITIONS).length + 1);
  });
});

describe('renderLanding — FAQ', () => {
  it('tem as 12 perguntas do spec como <details>/<summary> nativos', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const items = root.querySelectorAll('#faq details > summary');
    expect(items.length).toBe(12);
    expect(root.textContent).toMatch(/O Arena funciona só para futebol\?/);
  });

  it('publica JSON-LD FAQPage batendo com o conteúdo visível', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    const ld = JSON.parse(root.querySelector('script[type="application/ld+json"]').textContent);
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity.length).toBe(12);
  });
});

describe('renderLanding — footer e CTA final', () => {
  it('footer tem as 4 colunas do spec e o slogan oficial', () => {
    const root = document.getElementById('app');
    renderLanding(root);
    ['PRODUTO', 'CONTA', 'INSTITUCIONAL', 'SUPORTE'].forEach((col) => expect(root.textContent).toMatch(new RegExp(col)));
    expect(root.textContent).toMatch(/Competição ao seu alcance/i);
  });
});
