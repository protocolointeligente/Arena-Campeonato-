import { navigate } from '../app/router-v2.js';

export const LEGAL_CONTACT = 'ricardo.pace.jr@gmail.com';
const UPDATED = '28/09/2026';

export function privacyPolicyHTML() {
  return `
    <p><strong>ARENA Campeonatos</strong> respeita sua privacidade. Esta política explica quais dados tratamos, para quê, com quem compartilhamos e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>
    <h3>1. Dados que tratamos</h3>
    <ul>
      <li><strong>Conta do organizador:</strong> e-mail e identificador de acesso.</li>
      <li><strong>Dados do campeonato:</strong> equipes, atletas (nome, número, data de nascimento e foto, quando informados), comissão técnica, jogos, resultados, súmulas, locais e arbitragem — cadastrados pelo organizador.</li>
      <li><strong>Inscrições:</strong> nome da equipe, responsável, telefone, e-mail e lista de atletas enviados pelo formulário público de inscrição.</li>
      <li><strong>Pagamentos:</strong> status e identificadores da cobrança. Dados de cartão e bancários são tratados diretamente pelos intermediadores de pagamento e não ficam armazenados na ARENA.</li>
      <li><strong>Registros de auditoria:</strong> ação realizada, e-mail de quem realizou e data/hora, para segurança e rastreabilidade.</li>
      <li><strong>Métricas do portal público:</strong> contagem anônima de visualizações e cliques em patrocinadores, sem identificar o visitante.</li>
    </ul>
    <h3>2. Para que usamos</h3>
    <ul>
      <li>Operar os campeonatos: tabelas, chaveamentos, classificação, artilharia, disciplina, placar e documentos.</li>
      <li>Publicar o portal público do campeonato, quando o organizador o ativa.</li>
      <li>Processar inscrições e cobranças de planos e taxas.</li>
      <li>Garantir segurança, prevenir fraudes e cumprir obrigações legais.</li>
    </ul>
    <h3>3. Dados públicos</h3>
    <p>Quando o organizador publica o campeonato, nomes de equipes e atletas, fotos, resultados, estatísticas e comunicados ficam visíveis a qualquer pessoa com o link do portal. O organizador decide o que publicar e é responsável por ter autorização dos atletas — e dos pais ou responsáveis, no caso de menores de idade.</p>
    <h3>4. Compartilhamento</h3>
    <p>Não vendemos dados. Compartilhamos apenas o necessário com operadores que viabilizam o serviço: Google Firebase / Google Cloud (hospedagem, banco de dados, autenticação e armazenamento) e os intermediadores de pagamento Asaas e Mercado Pago (cobranças).</p>
    <h3>5. Retenção</h3>
    <p>Mantemos os dados enquanto a conta estiver ativa ou pelo tempo necessário para cumprir obrigações legais e resolver disputas. Você pode pedir a exclusão a qualquer momento (veja abaixo).</p>
    <h3>6. Segurança</h3>
    <p>Acesso restrito por autenticação, regras de permissão por campeonato (organizador e colaboradores convidados), conexão criptografada (HTTPS) e registro de auditoria das alterações.</p>
    <h3 id="lgpd">7. Seus direitos (LGPD, art. 18)</h3>
    <ul>
      <li>Confirmar se tratamos seus dados e acessá-los.</li>
      <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
      <li>Pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.</li>
      <li>Portabilidade dos dados.</li>
      <li>Eliminação dos dados tratados com consentimento, ressalvadas as hipóteses legais de guarda.</li>
      <li>Informação sobre compartilhamento e revogação do consentimento.</li>
    </ul>
    <p><strong>Como exercer:</strong> envie o pedido para o e-mail do encarregado abaixo, a partir do e-mail da sua conta. Organizadores também podem baixar o backup (JSON) de cada campeonato no próprio painel. Atletas e responsáveis por inscrições podem falar com o organizador do campeonato ou diretamente com o encarregado.</p>
    <h3>8. Encarregado (DPO) e contato</h3>
    <p>ARENA Campeonatos — e-mail: <a href="mailto:${LEGAL_CONTACT}">${LEGAL_CONTACT}</a></p>
    <p class="muted">Última atualização: ${UPDATED}.</p>
  `;
}

function termsHTML() {
  return `
    <p>Estes Termos regulam o uso da plataforma <strong>ARENA Campeonatos</strong>. Ao criar uma conta ou usar o serviço, você concorda com eles.</p>
    <h3>1. O serviço</h3>
    <p>A ARENA é uma plataforma online para organizar competições esportivas: cadastro de equipes e atletas, geração de tabelas e chaveamentos, registro de resultados e súmulas, placar ao vivo, portal público, inscrições e relatórios.</p>
    <h3>2. Conta</h3>
    <p>Você é responsável por manter sua senha em sigilo e por todas as ações realizadas na sua conta e pelos colaboradores que convidar. Informe-nos imediatamente sobre qualquer uso não autorizado.</p>
    <h3>3. Responsabilidades do organizador</h3>
    <ul>
      <li>Cadastrar dados verdadeiros e ter autorização para inserir e publicar dados de atletas e equipes — incluindo o consentimento dos pais ou responsáveis de menores de idade.</li>
      <li>Definir o regulamento da competição e validar resultados, classificações e punições geradas pela plataforma.</li>
      <li>Não usar o serviço para conteúdo ilegal, ofensivo, discriminatório ou que viole direitos de terceiros.</li>
    </ul>
    <h3>4. Planos e pagamentos</h3>
    <p>Recursos e limites variam conforme o plano contratado, descritos na página de planos. As cobranças são processadas por intermediadores de pagamento (Asaas e Mercado Pago). Assinaturas podem ser canceladas pela própria conta; o acesso segue até o fim do período já pago. Taxas de inscrição cobradas pelo organizador são de responsabilidade dele perante os inscritos.</p>
    <h3>5. Conteúdo e propriedade</h3>
    <p>Os dados que você cadastra continuam seus. Você nos autoriza a armazená-los e exibi-los apenas para prestar o serviço, inclusive no portal público quando você o publica. A marca, o software e o layout da ARENA pertencem à ARENA Campeonatos.</p>
    <h3>6. Disponibilidade</h3>
    <p>Trabalhamos para manter o serviço disponível e seguro, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. Recomendamos exportar backups (JSON e PDFs) dos campeonatos importantes.</p>
    <h3>7. Limitação de responsabilidade</h3>
    <p>A ARENA não se responsabiliza por decisões esportivas, disputas entre participantes ou prejuízos decorrentes de dados incorretos inseridos pelos usuários, nem por indisponibilidade causada por terceiros, na extensão permitida pela lei.</p>
    <h3>8. Suspensão e encerramento</h3>
    <p>Podemos suspender contas que violem estes Termos. Você pode pedir o encerramento da sua conta a qualquer momento pelo contato abaixo.</p>
    <h3>9. Privacidade</h3>
    <p>O tratamento de dados pessoais segue a nossa <a href="/privacidade" data-legal-link>Política de Privacidade</a>.</p>
    <h3>10. Alterações e contato</h3>
    <p>Estes Termos podem ser atualizados; mudanças relevantes serão comunicadas na plataforma. Dúvidas: <a href="mailto:${LEGAL_CONTACT}">${LEGAL_CONTACT}</a>.</p>
    <p class="muted">Última atualização: ${UPDATED}.</p>
  `;
}

const DOCS = {
  termos: { title: 'Termos de <em>uso</em>', body: termsHTML },
  privacidade: { title: 'Política de <em>privacidade</em>', body: privacyPolicyHTML },
};

export function renderLegal(root, doc) {
  const page = DOCS[doc] || DOCS.termos;
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/">ARENA</a><button class="btn ghost" data-back>← Voltar</button></header><main class="section"><div class="hero" style="padding-top:10px;min-height:0"><h1>${page.title}</h1></div><article class="card legal-doc" style="max-width:820px;line-height:1.65">${page.body()}<div class="row" style="gap:8px;margin-top:18px;flex-wrap:wrap"><button class="btn ghost" data-go="/termos">Termos de uso</button><button class="btn ghost" data-go="/privacidade">Política de privacidade</button><button class="btn ghost" data-go="/privacidade#lgpd">Seus direitos (LGPD)</button></div></article></main></div>`;
  root.querySelector('[data-back]').onclick = () => (history.length > 1 ? history.back() : navigate('/'));
  root.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => navigate(button.dataset.go); });
  root.querySelectorAll('[data-legal-link]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); navigate(link.getAttribute('href')); }));
  const anchor = window.location.hash && root.querySelector(window.location.hash);
  if (anchor) {anchor.scrollIntoView?.();} else {window.scrollTo?.(0, 0);}
}
