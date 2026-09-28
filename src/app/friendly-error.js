// Converte erros técnicos (Firebase, rede, TypeError) em mensagem em português pra tela.
// Mensagens que o próprio app já escreve em português passam direto.
const CODE_MESSAGES = {
  'permission-denied': 'Você não tem permissão para acessar este conteúdo. Entre com uma conta autorizada.',
  unauthenticated: 'Sua sessão expirou. Entre novamente para continuar.',
  'not-found': 'Não encontrado. O link pode estar incorreto ou o item foi removido.',
  unavailable: 'Serviço indisponível no momento. Verifique sua conexão e tente novamente.',
  'deadline-exceeded': 'A operação demorou demais. Tente novamente.',
  'resource-exhausted': 'Limite de uso atingido. Aguarde alguns instantes e tente novamente.',
  'failed-precondition': 'Não foi possível concluir a operação agora. Tente novamente.',
  'already-exists': 'Esse item já existe.',
  'invalid-argument': 'Dados inválidos. Revise as informações e tente novamente.',
  cancelled: 'Operação cancelada.',
  'unauthorized': 'Você não tem permissão para esta ação.',
  'object-not-found': 'Arquivo não encontrado.',
  'quota-exceeded': 'Limite de armazenamento atingido.',
  'network-request-failed': 'Sem conexão com a internet. Verifique sua rede.',
  'too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'invalid-credential': 'E-mail ou senha incorretos.',
  'wrong-password': 'E-mail ou senha incorretos.',
  'user-not-found': 'E-mail ou senha incorretos.',
  'invalid-email': 'E-mail inválido.',
  'email-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar".',
  'weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
  'user-disabled': 'Esta conta foi desativada. Fale com o suporte.',
  'popup-closed-by-user': 'Login cancelado.',
};

const TECHNICAL = /firebase: error|missing or insufficient permissions|cannot read propert|is not a function|is not defined|undefined|failed to fetch|networkerror|load failed|\[immer\]|internal error|unexpected token/i;

export function friendlyError(error, fallback = 'Algo deu errado. Tente novamente.') {
  if (!error) {return fallback;}
  const code = String(error.code || '').split('/').pop();
  if (code && CODE_MESSAGES[code]) {return CODE_MESSAGES[code];}
  const message = typeof error === 'string' ? error : error.message;
  if (!message) {return fallback;}
  if (/missing or insufficient permissions/i.test(message)) {return CODE_MESSAGES['permission-denied'];}
  if (/failed to fetch|networkerror|load failed/i.test(message)) {return CODE_MESSAGES['network-request-failed'];}
  if (TECHNICAL.test(message)) {return fallback;}
  return message;
}
