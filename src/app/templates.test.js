import { describe, expect, it } from 'vitest';
import { MODALITIES, templateConfig } from './templates.js';

describe('championship templates', () => {
  it('provides a complete configurable default for groups', () => {
    expect(templateConfig('futsal')).toMatchObject({ modalidade: 'futsal', formato: 'grupos', scoreType: 'goals', cfg: { discYellow: 1, discRed: 2 } });
  });

  it('falls back to league for unknown templates', () => {
    expect(templateConfig('unknown').formato).toBe('liga');
  });

  it('includes the requested modalities and sport-specific score models', () => {
    ['futebol', 'futsal', 'handebol', 'basquete', 'volei-de-praia', 'beach-tennis', 'tenis', 'peteca', 'badminton', 'padel', 'judô', 'jiu-jitsu', 'karatê', 'taekwondo', 'ginastica-artistica', 'ginastica-ritmica', 'hóquei', 'futebol-americano', 'rugby', 'tenis-de-mesa', 'squash', 'xadrez', 'triatlo', 'corrida', 'e-sports', 'bocha', 'polo'].forEach((id) => expect(MODALITIES[id]).toBeDefined());
    expect(templateConfig('beach-tennis').scoreType).toBe('sets');
    expect(templateConfig('judô').rosterMode).toBe('individual');
  });

  it('allows a compatible competition model override', () => {
    expect(templateConfig('futebol', 'mata')).toMatchObject({ modelo: 'mata', formato: 'mata' });
    expect(templateConfig('futsal', 'grupos').cfg.nGrupos).toBe(2);
  });

  it('uses scoring defaults appropriate to the sport', () => {
    expect(templateConfig('futebol').cfg).toMatchObject({ winPts: 3, drawPts: 1 });
    expect(templateConfig('volei-de-praia').cfg).toMatchObject({ winPts: 2, drawPts: 0 });
    expect(templateConfig('judô').cfg).toMatchObject({ winPts: 1, drawPts: 0 });
  });

  it('includes operational rules for roster and match structure', () => {
    expect(templateConfig('futebol').cfg).toMatchObject({ maxRoster: 30, periods: 2 });
    expect(templateConfig('volei-de-praia').cfg).toMatchObject({ maxRoster: 2, setsToWin: 2 });
    expect(templateConfig('judô').cfg).toMatchObject({ maxRoster: 1, periods: 1 });
  });
});
