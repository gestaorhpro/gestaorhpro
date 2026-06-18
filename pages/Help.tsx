
import React, { useState } from 'react';

const Help: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Geral');

  const faqs = [
    // --- GESTÃO DE PESSOAS ---
    { 
      question: 'Como cadastrar um novo colaborador?', 
      answer: 'No menu lateral, acesse "Candidatos / Colab.". Clique no botão "Adicionar" no canto superior direito, preencha os dados pessoais, cargo e departamento e clique em "Salvar Dados".', 
      category: 'Gestão de Pessoas' 
    },
    { 
      question: 'Como registrar férias de um funcionário?', 
      answer: 'Você pode alterar o status do colaborador para "Férias" na lista de Colaboradores (ícone de edição). Além disso, no Dashboard inicial, você pode aprovar ou reprovar solicitações de férias pendentes na tabela "Gerenciamento de Férias".', 
      category: 'Gestão de Pessoas' 
    },
    { 
      question: 'Como editar cargo ou departamento de alguém?', 
      answer: 'Na lista de colaboradores, clique diretamente sobre o nome do cargo ou departamento na linha do funcionário. Um menu aparecerá permitindo a troca rápida. Lembre-se de cadastrar novos cargos em "Configurações" primeiro, se necessário.', 
      category: 'Gestão de Pessoas' 
    },

    // --- RECRUTAMENTO ---
    { 
      question: 'Como criar e divulgar uma vaga?', 
      answer: 'Acesse o menu "Vagas". Clique em "Nova Vaga", preencha os requisitos e salve. Após criada, clique no menu de três pontos da vaga e selecione "Compartilhar Vaga" para obter o link público de inscrição.', 
      category: 'Recrutamento' 
    },
    { 
      question: 'Como gerenciar o processo seletivo (Pipeline)?', 
      answer: 'Na tela de "Vagas", clique no menu de ações (três pontos) da vaga desejada e escolha "Gerenciar Pipeline". Lá você terá uma visão Kanban onde pode arrastar candidatos entre as etapas (Triagem, Entrevista, Proposta, etc).', 
      category: 'Recrutamento' 
    },
    { 
      question: 'Como agendar uma entrevista?', 
      answer: 'Dentro do Pipeline da vaga, no cartão do candidato, clique no botão "Agendar Entrevista". Defina a data e hora. O status do candidato mudará automaticamente para "Entrevista".', 
      category: 'Recrutamento' 
    },

    // --- OPERACIONAL (EPIs) ---
    { 
      question: 'Como registrar a entrega de um EPI?', 
      answer: 'Acesse "Controle de EPIs". Na aba "Entregas", clique em "Nova Entrega". Selecione o funcionário e o item do estoque. O sistema solicitará uma assinatura digital (desenho na tela) para confirmar a entrega.', 
      category: 'Operacional' 
    },
    { 
      question: 'Como saber se um EPI está com estoque baixo?', 
      answer: 'O sistema avisa automaticamente. Na tela "Controle de EPIs", observe a barra lateral direita. Ela exibirá um alerta vermelho listando qualquer item que esteja abaixo da quantidade mínima configurada.', 
      category: 'Operacional' 
    },

    // --- SISTEMA / CONFIGURAÇÃO ---
    { 
      question: 'Como alterar os dados da minha empresa nos relatórios?', 
      answer: 'Vá em "Configurações" e localize a seção "Dados da Empresa". Preencha CNPJ, Razão Social, Endereço e Contato. Essas informações aparecerão automaticamente no cabeçalho dos holerites e relatórios.', 
      category: 'Sistema' 
    },
    { 
      question: 'Como adicionar novos departamentos ou cargos?', 
      answer: 'Em "Configurações", desça até "Estrutura Corporativa". Utilize os campos para adicionar novos Departamentos ou Cargos. Eles ficarão disponíveis imediatamente nos formulários de cadastro de colaboradores.', 
      category: 'Sistema' 
    },
    { 
      question: 'Como cadastrar feriados?', 
      answer: 'Ainda em "Configurações", na seção "Calendário de Feriados", insira o nome, a data e o tipo (Nacional/Regional).', 
      category: 'Sistema' 
    },
  ];

  const filteredFaqs = faqs.filter(faq => 
    (activeCategory === 'Geral' || faq.category === activeCategory) &&
    (faq.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
     faq.answer.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const categories = ['Geral', 'Gestão de Pessoas', 'Recrutamento', 'Operacional', 'Sistema'];

  const handleOpenTicket = () => {
    // Utilizando mailto para abrir o cliente de email padrão
    // Removido acento do email para garantir compatibilidade: pixelnegociosdigitais@gmail.com
    window.location.href = "mailto:pixelnegociosdigitais@gmail.com?subject=Suporte%20T%C3%A9cnico%20-%20Gest%C3%A3oRH%20Pro";
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      {/* Hero Search Section */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
           <span className="material-icons-outlined text-[150px] text-white">help_outline</span>
        </div>
        <div className="absolute bottom-0 left-0 p-4 opacity-5 pointer-events-none">
           <span className="material-icons-outlined text-[120px] text-white">admin_panel_settings</span>
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Central de Ajuda do Gestor</h2>
          <p className="text-slate-300 mb-8">Encontre instruções operacionais e guias do sistema.</p>
          
          <div className="relative">
            <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquise por funcionalidades (ex: holerite, EPI, vaga)..." 
              className="w-full pl-12 pr-4 py-4 rounded-xl border-none outline-none focus:ring-4 focus:ring-primary-500/30 text-slate-800 placeholder:text-slate-400 shadow-2xl transition-shadow"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Categories */}
        <div className="space-y-6">
           <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons-outlined text-primary-500">category</span>
                Módulos
              </h3>
              <div className="space-y-1">
                {categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setSearchTerm(''); }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex justify-between items-center ${
                        activeCategory === cat 
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 shadow-sm' 
                        : 'text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {cat}
                    {activeCategory === cat && <span className="material-icons-outlined text-sm">chevron_right</span>}
                  </button>
                ))}
              </div>
           </div>
           
           <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2 flex items-center gap-2">
                 <span className="material-icons-outlined">support_agent</span> Suporte Técnico
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-200 mb-3">
                 Encontrou um erro no sistema ou precisa de uma funcionalidade nova?
              </p>
              <button 
                onClick={handleOpenTicket}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                 Abrir Chamado
              </button>
           </div>
        </div>

        {/* Right Col: FAQs */}
        <div className="lg:col-span-2 space-y-6">
           {/* FAQ List */}
           <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-icons-outlined text-slate-400">quiz</span>
                    Instruções
                 </h3>
                 {searchTerm && (
                    <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-slate-500">
                        Filtrando por: "{searchTerm}"
                    </span>
                 )}
              </div>
              
              <div className="space-y-4">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((faq, idx) => (
                    <details key={idx} className="group border border-gray-100 dark:border-white/5 rounded-lg overflow-hidden open:bg-gray-50 dark:open:bg-white/5 transition-colors">
                      <summary className="flex justify-between items-center cursor-pointer list-none p-4 font-medium text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                        <span className="flex items-center gap-3">
                            <span className="material-icons-outlined text-slate-400 text-sm">article</span>
                            {faq.question}
                        </span>
                        <span className="material-icons-outlined text-slate-400 group-open:rotate-180 transition-transform duration-200">expand_more</span>
                      </summary>
                      <div className="px-4 pb-4 pt-0 text-slate-600 dark:text-slate-400 text-sm leading-relaxed pl-11 border-t border-gray-100 dark:border-white/5 mt-2 pt-3">
                        {faq.answer}
                      </div>
                    </details>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500 bg-gray-50 dark:bg-white/5 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                    <span className="material-icons-outlined text-4xl mb-2 opacity-50">search_off</span>
                    <p className="font-medium">Nenhum resultado encontrado</p>
                    <p className="text-sm">Tente buscar por termos diferentes ou navegue pelos módulos.</p>
                    <button onClick={() => setSearchTerm('')} className="mt-4 text-primary-500 hover:underline text-sm">Limpar busca</button>
                  </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
