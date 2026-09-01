import { z } from 'zod';

// Base schemas
export const idSchema = z.string().min(1, 'ID é obrigatório');
export const emailSchema = z.string().email('E-mail inválido').toLowerCase();
export const phoneSchema = z.string().min(8, 'Telefone inválido').max(20);
export const urlSchema = z.string().url('URL inválida').optional().or(z.literal(''));
export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser hexadecimal (ex: #2fcf6b)');
export const nonEmptyString = z.string().min(1, 'Campo obrigatório').trim();
export const optionalString = z.string().optional().transform(v => v?.trim() || '');
export const optionalStringMax = (max) => z.string().optional().transform(v => v?.trim() || '').refine(v => v.length <= max, `Máximo ${max} caracteres`);

// Championship schemas
export const championshipCreateSchema = z.object({
  nome: nonEmptyString.max(100, 'Nome muito longo (máx. 100 caracteres)'),
  subtitulo: optionalStringMax(200),
  formato: z.enum(['liga', 'grupos', 'gxg', 'mata'], { errorMap: () => ({ message: 'Formato inválido' }) }),
  modalidade: z.string().min(2).max(60).optional(),
  modelo: z.enum(['liga', 'grupos', 'mata', 'ranking', 'swiss']).optional(),
  scoreType: z.enum(['goals', 'sets', 'points']).optional(),
  rosterMode: z.enum(['team', 'dupla', 'individual']).optional(),
  status: z.enum(['rascunho', 'inscricoes', 'andamento', 'encerrado']).default('rascunho'),
  cfg: z.object({
    winPts: z.number().int().min(0).max(10).default(3),
    drawPts: z.number().int().min(0).max(10).default(1),
    lossPts: z.number().int().min(0).max(10).default(0),
    turnos: z.number().int().min(1).max(2).default(1),
    nGrupos: z.number().int().min(1).max(8).default(2),
    classificam: z.number().int().min(1).max(8).default(2),
    maoUnica: z.boolean().default(true),
    terceiro: z.boolean().default(true),
    criterios: z.array(z.enum(['P', 'V', 'SG', 'GP', 'GC', 'CD', 'DISC'])).default(['P', 'V', 'SG', 'GP', 'DISC']),
    confrontoDireto: z.boolean().default(true),
    discYellow: z.number().int().min(0).max(10).default(1),
    discRed: z.number().int().min(0).max(20).default(2),
    yellowLimit: z.number().int().min(1).max(10).default(3),
    maxRoster: z.number().int().min(1).max(50).default(50),
    setsToWin: z.number().int().min(1).max(7).default(1),
    periods: z.number().int().min(1).max(6).default(1),
  }).default({}),
  branding: z.object({
    accent: colorSchema.default('#2fcf6b'),
    logo: urlSchema,
    cover: urlSchema,
  }).default({}),
  sponsors: z.array(z.object({
    id: z.string(),
    name: nonEmptyString.max(100),
    url: urlSchema,
    logo: urlSchema,
  })).default([]),
});

export const championshipUpdateSchema = championshipCreateSchema.partial();

export const championshipScoringSchema = z.object({
  winPts: z.number().int().min(0).max(10),
  drawPts: z.number().int().min(0).max(10),
  lossPts: z.number().int().min(0).max(10),
  discYellow: z.number().int().min(0).max(10),
  discRed: z.number().int().min(0).max(20),
  yellowLimit: z.number().int().min(1).max(10),
  criterios: z.array(z.enum(['P', 'V', 'SG', 'GP', 'GC', 'CD', 'DISC'])).min(1, 'Pelo menos um critério'),
  confrontoDireto: z.boolean(),
});

// Category schemas
export const categoryCreateSchema = z.object({
  nome: nonEmptyString.max(50, 'Nome muito longo (máx. 50 caracteres)'),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

// Phase schemas
export const phaseCreateSchema = z.object({
  nome: nonEmptyString.max(50, 'Nome muito longo (máx. 50 caracteres)'),
  formato: z.enum(['liga', 'grupos', 'gxg', 'mata']),
  modelo: z.enum(['liga', 'grupos', 'mata', 'ranking', 'swiss']).optional(),
  scoreType: z.enum(['goals', 'sets', 'points']).optional(),
  cfg: z.object({
    turnos: z.number().int().min(1).max(2).default(1),
    nGrupos: z.number().int().min(1).max(8).default(2),
    maoUnica: z.boolean().default(true),
    terceiro: z.boolean().default(true),
    maxRoster: z.number().int().min(1).max(50).optional(),
    setsToWin: z.number().int().min(1).max(7).optional(),
    periods: z.number().int().min(1).max(6).optional(),
  }).default({}),
});

export const phaseUpdateSchema = phaseCreateSchema.partial();

export const phaseProgressionSchema = z.object({
  targetPhaseId: idSchema,
  mode: z.enum(['overall', 'perGroup']).default('overall'),
  count: z.number().int().min(1).max(16).default(2),
});

// Team schemas
export const teamCreateSchema = z.object({
  nome: nonEmptyString.max(50, 'Nome muito longo (máx. 50 caracteres)'),
});

export const teamUpdateSchema = teamCreateSchema.partial();

export const teamRosterSchema = z.object({
  teamId: idSchema,
  nome: nonEmptyString.max(50),
  numero: z.string().optional().transform(v => v?.trim() || ''),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)').optional().or(z.literal('')),
  foto: urlSchema,
});

// Athlete schemas
export const athleteCreateSchema = z.object({
  teamId: idSchema,
  nome: nonEmptyString.max(100, 'Nome muito longo (máx. 100 caracteres)'),
  numero: z.string().optional().transform(v => v?.trim() || ''),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)').optional().or(z.literal('')),
  foto: urlSchema,
});

export const athleteUpdateSchema = athleteCreateSchema.partial().omit({ teamId: true });

// Match schemas
export const matchScoreSchema = z.object({
  matchId: idSchema,
  field: z.enum(['hg', 'ag']),
  value: z.number().int().min(0).max(99).nullable(),
});

export const matchOpsSchema = z.object({
  matchId: idSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)').optional().or(z.literal('')),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida (HH:MM)').optional().or(z.literal('')),
  venueId: idSchema.optional().or(z.literal('')),
  refereeId: idSchema.optional().or(z.literal('')),
  tableOfficialId: idSchema.optional().or(z.literal('')),
  status: z.enum(['scheduled', 'live', 'finished', 'postponed', 'cancelled']).default('scheduled'),
  notes: optionalStringMax(500),
});

// Tie (bracket) schemas
export const tieScoreSchema = z.object({
  tieId: idSchema,
  field: z.enum(['ag1', 'bg1', 'ag2', 'bg2', 'apen', 'bpen']),
  value: z.number().int().min(0).max(99).nullable(),
});

// Venue schemas
export const venueCreateSchema = z.object({
  name: nonEmptyString.max(100, 'Nome muito longo'),
  address: optionalStringMax(200),
});

export const venueUpdateSchema = venueCreateSchema.partial();

// Official schemas
export const officialCreateSchema = z.object({
  name: nonEmptyString.max(100, 'Nome muito longo'),
  role: optionalStringMax(50),
});

export const officialUpdateSchema = officialCreateSchema.partial();

// Collaborator schemas
export const collaboratorInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'results', 'registrations', 'viewer'], { errorMap: () => ({ message: 'Papel inválido' }) }),
});

export const collaboratorRoleChangeSchema = z.object({
  id: idSchema,
  role: z.enum(['admin', 'results', 'registrations', 'viewer']),
});

// Branding schemas
export const brandingImageSchema = z.object({
  kind: z.enum(['logo', 'cover']),
  url: urlSchema,
});

export const sponsorCreateSchema = z.object({
  name: nonEmptyString.max(100, 'Nome muito longo'),
  url: urlSchema,
  logo: urlSchema,
});

export const sponsorUpdateSchema = sponsorCreateSchema.partial();

// Registration (public) schemas
export const registrationSubmitSchema = z.object({
  rosterMode: z.enum(['team', 'dupla', 'individual']).default('team'),
  teamName: nonEmptyString.max(100),
  responsible: nonEmptyString.max(100),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  coach: optionalStringMax(100),
  athletes: z.array(z.object({
    name: nonEmptyString.max(100),
  })).min(1, 'Pelo menos um atleta').max(50),
  captchaToken: nonEmptyString,
  consent: z.literal(true, { errorMap: () => ({ message: 'Deve confirmar o consentimento' }) }),
}).superRefine((value, context) => {
  if (value.rosterMode === 'individual' && value.athletes.length !== 1) {context.addIssue({ code: 'custom', path: ['athletes'], message: 'Modalidade individual exige 1 participante' });}
  if (value.rosterMode === 'dupla' && value.athletes.length !== 2) {context.addIssue({ code: 'custom', path: ['athletes'], message: 'Modalidade de dupla exige 2 participantes' });}
});

// Utility functions
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const errors = result.error.flatten().fieldErrors;
  const messages = Object.entries(errors).flatMap(([field, msgs]) => 
    msgs.map(msg => `${field}: ${msg}`)
  );
  return { ok: false, errors: messages.join('; '), fieldErrors: errors };
}

export function validateAsync(schema, data) {
  return schema.parseAsync(data);
}

// Partial validation for form fields
export function validateField(schema, fieldName, value) {
  const fieldSchema = schema.shape[fieldName];
  if (!fieldSchema) {return { ok: true };}
  
  const result = fieldSchema.safeParse(value);
  if (result.success) {return { ok: true };}
  
  return { ok: false, error: result.error.flatten().formErrors[0] || 'Valor inválido' };
}

// Schema map for easy access
export const schemas = {
  championship: { create: championshipCreateSchema, update: championshipUpdateSchema, scoring: championshipScoringSchema },
  category: { create: categoryCreateSchema, update: categoryUpdateSchema },
  phase: { create: phaseCreateSchema, update: phaseUpdateSchema, progression: phaseProgressionSchema },
  team: { create: teamCreateSchema, update: teamUpdateSchema, roster: teamRosterSchema },
  athlete: { create: athleteCreateSchema, update: athleteUpdateSchema },
  match: { score: matchScoreSchema, ops: matchOpsSchema },
  tie: { score: tieScoreSchema },
  venue: { create: venueCreateSchema, update: venueUpdateSchema },
  official: { create: officialCreateSchema, update: officialUpdateSchema },
  collaborator: { invite: collaboratorInviteSchema, roleChange: collaboratorRoleChangeSchema },
  branding: { image: brandingImageSchema },
  sponsor: { create: sponsorCreateSchema, update: sponsorUpdateSchema },
  registration: { submit: registrationSubmitSchema },
};

// Export z for custom validations
export { z };

