# Landing Page ARENA com Conversão via Pix

## Objetivo

Criar uma landing page pública para o ARENA como primeira tela do site, apresentando o produto, os principais benefícios e os planos comerciais. O botão principal deve levar visitantes ao cadastro/login; os planos pagos devem continuar usando o checkout Pix já existente.

## Experiência proposta

- Visitantes chegam à landing page antes do painel.
- “Começar agora” abre o fluxo existente de autenticação/cadastro.
- “Ver planos” abre a tela de planos existente.
- “Explorar demonstração” abre o modo Demo atual.
- Usuários autenticados continuam sendo direcionados ao painel de campeonatos.
- O checkout Pix permanece manual, com chave Pix, valor, botão de cópia e confirmação da solicitação.

## Conteúdo

- Hero: “Organize campeonatos. Encante sua torcida.”
- Benefícios: tabelas automáticas, inscrições por link, jogos/súmulas/resultados e portal público em tempo real.
- Seção de demonstração com acesso ao Demo.
- Planos Grátis, Essencial (R$ 39,90/mês) e Pro (R$ 199,90/mês), reutilizando os dados já definidos no sistema.
- Chamada final: “Seu próximo campeonato começa aqui.”
- Rodapé com links para login, planos, privacidade e demonstração.

## Arquitetura

A implementação permanecerá no HTML único existente. Será adicionada uma tela pública de landing page e o roteamento inicial será ajustado para mostrar essa tela quando não houver uma rota de campeonato público, inscrição ou sessão autenticada. O painel administrativo e o portal público de campeonatos não serão reestruturados.

## Regras de visibilidade

- Não exibir Firebase, Firestore, Superadmin, Auditoria, Produção ou Beta na landing page.
- Não alterar a chave Pix ou os valores dos planos nesta tarefa.
- Manter a identificação “Ambiente demonstrativo” no modo Demo.

## Validação

- Validar a sintaxe dos scripts embutidos.
- Confirmar que a rota inicial exibe a landing page.
- Confirmar que os botões de login, planos e demonstração chamam os fluxos existentes.
- Confirmar que a tela de checkout Pix continua acessível pelos planos pagos.
