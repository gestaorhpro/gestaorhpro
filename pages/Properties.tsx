import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Property, FurnitureItem, Employee, Page, Work } from '../types';

const Properties: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'occupied' | 'empty'>('all');

  // Expanded property state for viewing detail inside list
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  // Form Fields State
  const [propertyName, setPropertyName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [notes, setNotes] = useState('');
  const [associatedWorkName, setAssociatedWorkName] = useState('');
  const [associatedWorkId, setAssociatedWorkId] = useState('');
  const [isAssociatingWork, setIsAssociatingWork] = useState(false);

  // Works state list
  const [works, setWorks] = useState<Work[]>([]);

  // States for Quick Creation of a Work inside properties modal
  const [showQuickWorkModal, setShowQuickWorkModal] = useState(false);
  const [quickWorkName, setQuickWorkName] = useState('');
  const [quickWorkType, setQuickWorkType] = useState<Work['type']>('Outros');
  const [quickWorkStartDate, setQuickWorkStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickWorkEndDate, setQuickWorkEndDate] = useState('');
  const [quickWorkStatus, setQuickWorkStatus] = useState<Work['status']>('Planejado');
  const [isSavingQuickWork, setIsSavingQuickWork] = useState(false);

  // Form Furniture State list
  const [formFurniture, setFormFurniture] = useState<FurnitureItem[]>([]);
  const [tempFurnitureName, setTempFurnitureName] = useState('');
  const [tempFurnitureQty, setTempFurnitureQty] = useState(1);
  const [tempFurnitureCondition, setTempFurnitureCondition] = useState<FurnitureItem['condition']>('Bom');

  // Form Residents list (checked employee IDs)
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch employees to resolve resident names inside details
      const { data: employeesData } = await supabase.from('employees').select('*');
      if (employeesData) {
        setEmployees(employeesData as Employee[]);
      }

      // Fetch works
      const { data: worksData } = await supabase.from('works').select('*');
      if (worksData) {
        setWorks(worksData as Work[]);
      }

      // Fetch properties
      const { data: propertiesData } = await supabase.from('properties').select('*');
      
      if (propertiesData) {
        // Deduplica por ID para evitar "two children with the same key" se o localStorage estiver sujo de rodadas anteriores
        const uniqueProperties: Property[] = [];
        const seenIds = new Set<string>();
        for (const prop of (propertiesData as Property[])) {
          if (prop && prop.id && !seenIds.has(prop.id)) {
            seenIds.add(prop.id);
            uniqueProperties.push(prop);
          }
        }
        setProperties(uniqueProperties);

        // Corrige o localStorage silenciosamente se houveram duplicatas
        if (uniqueProperties.length !== propertiesData.length) {
          localStorage.setItem('gestaorh_db_properties', JSON.stringify(uniqueProperties));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuickWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickWorkName.trim()) {
      alert('Por favor, informe o nome da obra.');
      return;
    }

    try {
      setIsSavingQuickWork(true);
      const newWorkId = `work-${Date.now()}`;
      
      const newWorkItem: Work = {
        id: newWorkId,
        name: quickWorkName.trim(),
        type: quickWorkType,
        startDate: quickWorkStartDate || new Date().toISOString().split('T')[0],
        estimatedEndDate: quickWorkEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: quickWorkStatus,
        employeeIds: [],
        toolIds: [],
        propertyId: '', // Será vinculado se necessário
        notes: 'Cadastrada via módulo de Imóveis/Alojamentos'
      };

      const { error } = await supabase.from('works').insert(newWorkItem);
      if (error) throw error;

      // Também grava no backup localStorage se estiver presente em outros componentes
      const localWorksStr = localStorage.getItem('gestaorh_db_works');
      if (localWorksStr) {
        try {
          const localWorks = JSON.parse(localWorksStr);
          localStorage.setItem('gestaorh_db_works', JSON.stringify([...localWorks, newWorkItem]));
        } catch (err) {
          localStorage.setItem('gestaorh_db_works', JSON.stringify([newWorkItem]));
        }
      } else {
        localStorage.setItem('gestaorh_db_works', JSON.stringify([newWorkItem]));
      }

      // Atualiza estado de obras
      const { data: updatedWorks } = await supabase.from('works').select('*');
      if (updatedWorks) {
        setWorks(updatedWorks as Work[]);
      } else {
        setWorks(prev => [...prev, newWorkItem]);
      }

      // Seleciona automaticamente na tela atual
      setAssociatedWorkId(newWorkId);
      setAssociatedWorkName(newWorkItem.name);
      setIsAssociatingWork(true);
      
      // Fecha modal rápido
      setShowQuickWorkModal(false);
      
      // Reseta inputs
      setQuickWorkName('');
      setQuickWorkType('Outros');
      setQuickWorkEndDate('');
      setQuickWorkStatus('Planejado');
      
      showToast(`Obra "${newWorkItem.name}" cadastrada e associada com sucesso!`);
    } catch (err) {
      console.error('Erro ao cadastrar obra rápida:', err);
      alert('Falha ao cadastrar a obra. Por favor, tente novamente.');
    } finally {
      setIsSavingQuickWork(false);
    }
  };

  // Lookup ZIP using ViaCEP api
  const handleZipLookup = async () => {
    const cleanZip = zipCode.replace(/\D/g, '');
    if (cleanZip.length !== 8) {
      showToast('O CEP deve conter exatamente 8 dígitos.');
      return;
    }

    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`);
      const data = await resp.json();
      if (data.erro) {
        showToast('CEP não encontrado na base pública.');
        return;
      }

      setStreet(data.logradouro || '');
      setNeighborhood(data.bairro || '');
      setCity(data.localidade || '');
      setState(data.uf || '');
      showToast('Endereço preenchido automaticamente!');
    } catch (err) {
      console.error('Erro de busca de CEP:', err);
      showToast('Falha ao comunicar com o buscador de CEP.');
    }
  };

  const handleOpenAddModal = () => {
    setEditingProperty(null);
    setPropertyName('');
    setZipCode('');
    setStreet('');
    setNumber('');
    setComplement('');
    setNeighborhood('');
    setCity('');
    setState('');
    setNotes('');
    setAssociatedWorkId('');
    setAssociatedWorkName('');
    setIsAssociatingWork(false);
    setShowQuickWorkModal(false);
    setFormFurniture([]);
    setSelectedResidentIds([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Property) => {
    setEditingProperty(p);
    setPropertyName(p.name);
    setZipCode(p.addressZip);
    setStreet(p.addressStreet);
    setNumber(p.addressNumber);
    setComplement(p.addressComplement || '');
    setNeighborhood(p.addressNeighborhood);
    setCity(p.addressCity);
    setState(p.addressState);
    setNotes(p.notes || '');
    setAssociatedWorkId(p.associatedWorkId || '');
    setAssociatedWorkName(p.associatedWorkName || '');
    setIsAssociatingWork(!!p.associatedWorkId || !!p.associatedWorkName);
    setShowQuickWorkModal(false);
    setFormFurniture([...p.furniture]);
    setSelectedResidentIds([...p.residentIds]);
    setIsModalOpen(true);
  };

  // Dynamic furniture item operations inside form
  const handleAddFurnitureToForm = () => {
    if (!tempFurnitureName.trim()) {
      alert('Por favor, informe o nome ou descrição do móvel.');
      return;
    }

    const newItem: FurnitureItem = {
      id: `fur-${Math.random().toString(36).substring(2, 9)}`,
      name: tempFurnitureName.trim(),
      quantity: tempFurnitureQty,
      condition: tempFurnitureCondition
    };

    setFormFurniture([...formFurniture, newItem]);
    setTempFurnitureName('');
    setTempFurnitureQty(1);
    setTempFurnitureCondition('Bom');
  };

  const handleRemoveFurnitureFromForm = (id: string) => {
    setFormFurniture(formFurniture.filter(item => item.id !== id));
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!propertyName.trim()) {
      alert('Insira um nome ou descrição para identificar o imóvel.');
      return;
    }
    if (!street.trim() || !number.trim() || !city.trim() || !state.trim()) {
      alert('Por favor, preencha o endereço completo (Rua, Número, Cidade e Estado).');
      return;
    }

    try {
      setIsSubmitting(true);

      const propId = editingProperty 
        ? editingProperty.id 
        : `property-${Math.random().toString(36).substring(2, 9)}`;

      const savedProperty: Property = {
        id: propId,
        name: propertyName.trim(),
        addressZip: zipCode.trim(),
        addressStreet: street.trim(),
        addressNumber: number.trim(),
        addressComplement: complement.trim() || undefined,
        addressNeighborhood: neighborhood.trim(),
        addressCity: city.trim(),
        addressState: state.toUpperCase(),
        furniture: formFurniture,
        residentIds: selectedResidentIds,
        notes: notes.trim() || undefined,
        associatedWorkId: isAssociatingWork ? (associatedWorkId || undefined) : undefined,
        associatedWorkName: isAssociatingWork ? (associatedWorkName.trim() || undefined) : undefined
      };

      // REGRA DE TROCA/TRANSFERÊNCIA DE CASA DO COLABORADOR:
      // Se algum colaborador selecionado nesta casa já estava cadastrado em outra casa,
      // ele deve ser desvinculado da casa anterior automaticamente.
      // E se estamos em modo de edição, colaboradores desmarcados também perderão a casa atual.
      
      // Carrega propriedades atuais para poder ajustar moradores
      const { data: allProps } = await supabase.from('properties').select('*');
      const currentPropsList: Property[] = allProps ? [...allProps] : [];

      // Passa por todas as outras casas e remove os IDs que agora estão nesta casa.
      const updatedOtherProps = currentPropsList
        .filter(p => p.id !== propId)
        .map(p => {
          const cleanResidents = p.residentIds.filter(id => !selectedResidentIds.includes(id));
          return { ...p, residentIds: cleanResidents };
        });

      // Salva cada outra casa atualizada
      for (const updatedOther of updatedOtherProps) {
        await supabase
          .from('properties')
          .update({ residentIds: updatedOther.residentIds })
          .eq('id', updatedOther.id);
      }

      // Agora insere/atualiza a casa atual
      if (editingProperty) {
        await supabase
          .from('properties')
          .update(savedProperty)
          .eq('id', propId);
        showToast('Imóvel e mobiliários atualizados com sucesso!');
      } else {
        await supabase
          .from('properties')
          .insert(savedProperty);
        showToast('Novo imóvel de acomodação cadastrado com sucesso!');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar imóvel:', err);
      showToast('Ocorreu um erro ao salvar o registro de imóvel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProperty = async (p: Property) => {
    if (!window.confirm(`Deseja realmente excluir o imóvel "${p.name}"? Colaboradores hospedados serão desvinculados.`)) {
      return;
    }

    try {
      setLoading(true);
      await supabase.from('properties').delete().eq('id', p.id);
      showToast(`Imóvel "${p.name}" removido com sucesso.`);
      fetchData();
    } catch (err) {
      console.error('Erro ao excluir imóvel:', err);
      showToast('Falha ao excluir o imóvel.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle resident selection on form checkboxes
  const handleToggleResident = (empId: string) => {
    if (selectedResidentIds.includes(empId)) {
      setSelectedResidentIds(selectedResidentIds.filter(id => id !== empId));
    } else {
      setSelectedResidentIds([...selectedResidentIds, empId]);
    }
  };

  // Quick helper to fetch helper texts for residents assigned
  const getEmployeeHostingInfo = (empId: string, currentEditingPropId?: string) => {
    const assignedProperty = properties.find(p => p.residentIds.includes(empId));
    if (assignedProperty) {
      if (currentEditingPropId && assignedProperty.id === currentEditingPropId) {
        return 'Hospedado aqui';
      }
      return `Hospedado em: ${assignedProperty.name}`;
    }
    return 'Livre / Não Hospedado';
  };

  // Main filters
  const filteredProperties = properties.filter(p => {
    // Search filter
    if (searchTerm.trim() !== '') {
      const search = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(search);
      const matchCity = p.addressCity.toLowerCase().includes(search);
      const matchStreet = p.addressStreet.toLowerCase().includes(search);
      const matchWork = p.associatedWorkName?.toLowerCase().includes(search);
      
      // Look up assigned residents' names to match
      const hasMatchingResidentName = p.residentIds.some(id => {
        const emp = employees.find(e => e.id === id);
        return emp?.name.toLowerCase().includes(search);
      });

      if (!matchName && !matchCity && !matchStreet && !matchWork && !hasMatchingResidentName) {
        return false;
      }
    }

    // Tab filter
    if (activeTab === 'occupied' && p.residentIds.length === 0) return false;
    if (activeTab === 'empty' && p.residentIds.length > 0) return false;

    return true;
  });

  // Calculate statistics
  const totalPropertiesCount = properties.length;
  const occupiedPropertiesCount = properties.filter(p => p.residentIds.length > 0).length;
  const emptyPropertiesCount = totalPropertiesCount - occupiedPropertiesCount;
  const totalHousedEmployees = properties.reduce((accum, p) => accum + p.residentIds.length, 0);
  const totalFurniturePieces = properties.reduce(
    (accum, p) => accum + p.furniture.reduce((sub, f) => sub + f.quantity, 0),
    0
  );

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Controle de Imóveis & Mobiliários</h2>
          <p className="text-slate-500 dark:text-slate-400">Gerenciamento completo das moradias disponibilizadas, mobília catalogada e alocação dinâmica de coligados.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-sm px-5 py-3 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.01] transition-all flex items-center gap-2"
        >
          <span className="material-icons-outlined text-sm">add_business</span>
          Cadastrar Casa / Imóvel
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Total de Imóveis</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalPropertiesCount}</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-500 rounded-xl">
            <span className="material-icons-outlined text-xl">home</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-emerald-550 uppercase tracking-widest block">Com Moradores</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{occupiedPropertiesCount}</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-500 rounded-xl">
            <span className="material-icons-outlined text-xl">people_alt</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-orange-500 uppercase tracking-widest block">Disponíveis (Vazios)</span>
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">{emptyPropertiesCount}</span>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-900/10 text-orange-500 rounded-xl">
            <span className="material-icons-outlined text-xl">meeting_room</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest block">Total Mobílias Cadastradas</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{totalFurniturePieces}</span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 text-indigo-500 rounded-xl">
            <span className="material-icons-outlined text-xl">kitchen</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Tabs */}
      <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-dark-border space-y-4">
        <div className="relative">
          <span className="material-icons-outlined absolute left-3 top-3 text-slate-400">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por descrição, cidade, rua, obra vinculada ou nome de colaborador morador..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50/50 dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 dark:border-white/5 pt-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'all'
                ? 'bg-slate-800 border-slate-800 text-white dark:bg-white dark:border-white dark:text-slate-900'
                : 'bg-slate-50 hover:bg-slate-100 border-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            Todos Imóveis ({totalPropertiesCount})
          </button>
          <button
            onClick={() => setActiveTab('occupied')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'occupied'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            Hospedados (Com Colaboradores) ({properties.filter(p => p.residentIds.length > 0).length})
          </button>
          <button
            onClick={() => setActiveTab('empty')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'empty'
                ? 'bg-orange-600 border-orange-600 text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            Vazios Reais / Livres ({properties.filter(p => p.residentIds.length === 0).length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 flex justify-center items-center">
          <span className="material-icons-outlined animate-spin text-4xl text-primary-500">refresh</span>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-dark-card shadow-xs">
          <span className="material-icons-outlined text-4xl text-slate-350 dark:text-slate-650 mb-2">hotel</span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum imóvel ou alojamento encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Experimente alterar os termos de busca ou filtros ativos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProperties.map((p) => {
            const isExpanded = expandedPropertyId === p.id;
            const residentsHere = employees.filter(e => p.residentIds.includes(e.id));
            
            return (
              <div 
                key={p.id}
                className={`bg-white dark:bg-dark-card rounded-2xl border ${
                  p.residentIds.length > 0 ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-orange-500'
                } border-gray-100 dark:border-dark-border p-5 transition-all shadow-xs flex flex-col justify-between`}
              >
                <div>
                  {/* Title and Badge */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <h4 className="font-extrabold text-lg text-slate-800 dark:text-white">{p.name}</h4>
                      {p.associatedWorkName ? (
                        <div className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-md">
                          <span className="material-icons-outlined text-[14px]">construction</span>
                          Obra: {p.associatedWorkName}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 mt-1 text-[11px] text-slate-400 dark:text-slate-500 font-semibold bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded">
                          <span className="material-icons-outlined text-[13px]">add_link</span>
                          Livre para vincular obras
                        </div>
                      )}
                    </div>
                    
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black leading-none ${
                      p.residentIds.length > 0 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                        : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                    }`}>
                      {p.residentIds.length > 0 ? `${p.residentIds.length} residente(s)` : 'Vazio'}
                    </span>
                  </div>

                  {/* Complete Address Details */}
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-4 bg-slate-50 dark:bg-white/5 p-3 rounded-xl select-all font-medium">
                    <p className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <span className="material-icons-outlined text-sm text-slate-400">place</span>
                      {p.addressStreet}, Nº {p.addressNumber}
                    </p>
                    {p.addressComplement && <p className="pl-5 text-slate-400">Comp: {p.addressComplement}</p>}
                    <p className="pl-5">{p.addressNeighborhood} — {p.addressCity}/{p.addressState}</p>
                    <p className="pl-5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">CEP {p.addressZip}</p>
                  </div>

                  {/* Notes / Observações */}
                  {p.notes && (
                    <p className="text-xs italic text-slate-400 dark:text-slate-550 mb-4 line-clamp-2">
                       &ldquo;{p.notes}&rdquo;
                    </p>
                  )}

                  {/* Quick summary of Furniture Content */}
                  <div className="border-t border-gray-100 dark:border-white/5 pt-3.5 mt-3.5 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-650 dark:text-slate-350">Mobiliário ({p.furniture.reduce((s, f) => s + f.quantity, 0)} itens)</span>
                      <button 
                        onClick={() => setExpandedPropertyId(isExpanded ? null : p.id)}
                        className="text-[11px] font-extrabold text-primary-500 hover:underline flex items-center gap-1"
                      >
                        {isExpanded ? 'Ocultar detalhes' : 'Ver mobília e moradores'}
                        <span className="material-icons-outlined text-xs">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    </div>

                    {/* Compressed furniture tags */}
                    {!isExpanded && p.furniture.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.furniture.slice(0, 4).map(f => (
                          <span key={f.id} className="text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                            {f.quantity}x {f.name}
                          </span>
                        ))}
                        {p.furniture.length > 4 && (
                          <span className="text-[10px] font-bold text-primary-550 px-1 py-0.5">
                            +{p.furniture.length - 4} mais
                          </span>
                        )}
                      </div>
                    )}

                    {/* Detailed furniture list & resident list when card is expanded */}
                    {isExpanded && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Interactive Furniture Items */}
                        <div className="bg-slate-50 dark:bg-[#1A1A1A] p-3 rounded-xl border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500 tracking-wider block mb-2">Inventário de Móveis Cadastrados</span>
                          {p.furniture.length === 0 ? (
                            <p className="text-xs text-slate-400">Nenhum mobiliário cadastrado.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {p.furniture.map(f => {
                                const stateColors = {
                                  Novo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20',
                                  Bom: 'bg-blue-50 text-blue-750 dark:bg-blue-950/20',
                                  Regular: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20',
                                  Ruim: 'bg-red-55/10 text-red-500'
                                };
                                return (
                                  <div key={f.id} className="flex justify-between items-center text-xs p-2 rounded bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{f.quantity}x {f.name}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${stateColors[f.condition]}`}>{f.condition}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Interactive Housed Residents */}
                        <div className="bg-slate-50 dark:bg-[#1A1A1A] p-3 rounded-xl border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500 tracking-wider block mb-2">Colaboradores Alojados Atual</span>
                          {residentsHere.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Nenhum colaborador alocado nesta casa no momento.</p>
                          ) : (
                            <div className="space-y-2">
                              {residentsHere.map(res => (
                                <div key={res.id} className="flex items-center justify-between p-2 rounded bg-white dark:bg-white/5 border border-gray-100 dark:border-[#333]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-750 text-[10px] font-black flex items-center justify-center shrink-0">
                                      {res.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{res.name}</span>
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{res.role} — {res.department}</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-emerald-550 font-bold uppercase">Ativo</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card footer action buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-150/50 dark:border-white/5 mt-4">
                  <button
                    onClick={() => handleOpenEditModal(p)}
                    className="p-2 border border-gray-200 hover:border-primary-500 dark:border-white/10 hover:bg-primary-500/10 text-slate-500 hover:text-primary-500 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    title="Editar Imóvel"
                  >
                    <span className="material-icons-outlined text-sm">edit</span>
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDeleteProperty(p)}
                    className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-550 rounded-xl text-xs font-bold transition-all"
                    title="Excluir Imóvel"
                  >
                    <span className="material-icons-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-2xl z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary-550">location_city</span>
                {editingProperty ? 'Editar Imóvel e Mobília' : 'Cadastrar Novo Imóvel / Alojamento'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProperty} className="p-5 space-y-4 overflow-y-auto">
              
              {/* Seção 1: Identificação do Imóvel */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl space-y-3">
                <span className="text-[10px] uppercase font-black text-primary-600 dark:text-primary-400 tracking-wider block">1. Identificação Geral</span>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Nome/Identificador do Imóvel</label>
                  <input
                    type="text"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    placeholder="Ex: Casa de Porto Alegre, Alojamento Curitiba, Casa de Apoio, etc."
                    className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Obra Associada</label>
                  
                  {/* Seletor de Opção: Deixar em branco ou Associar */}
                  <div className="flex gap-4 items-center mb-3 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-gray-100 dark:border-white/5">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer select-none">
                      <input 
                        type="radio" 
                        name="work_association" 
                        checked={!isAssociatingWork} 
                        onChange={() => {
                          setIsAssociatingWork(false);
                          setAssociatedWorkId('');
                          setAssociatedWorkName('');
                        }}
                        className="text-primary-500 focus:ring-primary-500 bg-white dark:bg-[#1E1E1E] border-gray-300 dark:border-white/10" 
                      />
                      <span className="flex items-center gap-1">
                        <span className="material-icons-outlined text-sm text-slate-400">link_off</span>
                        Deixar em branco (Sem obra)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer select-none">
                      <input 
                        type="radio" 
                        name="work_association" 
                        checked={isAssociatingWork} 
                        onChange={() => {
                          setIsAssociatingWork(true);
                        }}
                        className="text-primary-500 focus:ring-primary-500 bg-white dark:bg-[#1E1E1E] border-gray-300 dark:border-white/10" 
                      />
                      <span className="flex items-center gap-1">
                        <span className="material-icons-outlined text-sm text-primary-550">link</span>
                        Associar uma Obra
                      </span>
                    </label>
                  </div>

                  {isAssociatingWork && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex gap-2">
                        <select
                          value={associatedWorkId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setAssociatedWorkId(selectedId);
                            const selectedWork = works.find(w => w.id === selectedId);
                            setAssociatedWorkName(selectedWork ? selectedWork.name : '');
                          }}
                          className="flex-1 p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none font-semibold"
                        >
                          <option value="" className="text-slate-500 dark:text-black">-- Selecione uma Obra / Canteiro cadastrado --</option>
                          {works.map(w => (
                            <option key={w.id} value={w.id} className="text-slate-800 dark:text-black">
                              {w.name} ({w.status})
                            </option>
                          ))}
                        </select>
                        
                        <button
                          type="button"
                          onClick={() => setShowQuickWorkModal(true)}
                          className="px-3.5 py-2.5 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm shrink-0 transition-all hover:scale-[1.02]"
                          title="Cadastrar nova obra rapidamente"
                        >
                          <span className="material-icons-outlined text-base">add_circle_outline</span>
                          Nova Obra
                        </button>
                      </div>

                      {associatedWorkId ? (
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                          <span className="material-icons-outlined text-base text-emerald-500">check_circle</span>
                          <span>Obra associada: <strong className="font-extrabold">{associatedWorkName}</strong></span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                          Selecione uma obra listada acima ou clique em "Nova Obra" para cadastrar uma no momento.
                        </p>
                      )}
                    </div>
                  )}
                  
                  <span className="text-[10px] text-slate-400 mt-1.5 block">Este imóvel se ligará automaticamente ao módulo de Obra correspondente em seguida.</span>
                </div>
              </div>

              {/* Seção 2: Endereço Detalhado com CEP Lookup */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl space-y-3">
                <span className="text-[10px] uppercase font-black text-primary-600 dark:text-primary-400 tracking-wider block">2. Endereço Completo do Imóvel</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">CEP</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        placeholder="90000-000"
                        className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={handleZipLookup}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition-colors"
                        title="Buscar endereço pelo CEP"
                      >
                        Buscar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Rua / Logradouro</label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Nome da avenida, rua, travessa..."
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Número</label>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="123"
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Complemento</label>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apto 302, Bloco A, Casa de Fundos"
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1.5">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Bairro</label>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Salgado Filho"
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Cidade</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Porto Alegre"
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">UF (Estado)</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="RS"
                      maxLength={2}
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: Mobiliários Inteligentes */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl space-y-4">
                <span className="text-[10px] uppercase font-black text-primary-600 dark:text-primary-400 tracking-wider block">3. Catálogo de Mobília do Imóvel</span>
                
                {/* Temp input builder */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white dark:bg-[#1E1E1E] p-3 rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                  <div className="sm:col-span-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nome do Item/Móvel</label>
                    <input
                      type="text"
                      value={tempFurnitureName}
                      onChange={(e) => setTempFurnitureName(e.target.value)}
                      placeholder="Ex: Cama de solteiro, Fogão, Mesa, etc."
                      className="w-full p-2 border border-gray-200 dark:border-white/10 rounded bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-xs font-semibold"
                    />
                    {/* Prestigious pre-defined furniture tags */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['Cama de Solteiro', 'Cama de Casal', 'Fogão', 'Geladeira', 'Armário', 'Ducha Elétrica'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setTempFurnitureName(tag)}
                          className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 dark:bg-white/5 border border-gray-200 text-slate-500 hover:text-primary-505"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Qtd</label>
                    <input
                      type="number"
                      value={tempFurnitureQty}
                      onChange={(e) => setTempFurnitureQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2 border border-gray-200 dark:border-white/10 rounded bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-xs font-semibold"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Conservação</label>
                    <select
                      value={tempFurnitureCondition}
                      onChange={(e) => setTempFurnitureCondition(e.target.value as FurnitureItem['condition'])}
                      className="w-full p-2 border border-gray-200 dark:border-white/10 rounded bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-gray-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="Novo" className="bg-white dark:bg-[#1E1E1E] text-slate-850 dark:text-gray-100">Novo</option>
                      <option value="Bom" className="bg-white dark:bg-[#1E1E1E] text-slate-850 dark:text-gray-100">Bom</option>
                      <option value="Regular" className="bg-white dark:bg-[#1E1E1E] text-slate-850 dark:text-gray-100">Regular</option>
                      <option value="Ruim" className="bg-white dark:bg-[#1E1E1E] text-slate-850 dark:text-gray-100">Ruim</option>
                    </select>
                  </div>
                  
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddFurnitureToForm}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors self-end uppercase tracking-wider"
                    >
                      <span className="material-icons-outlined text-[12px]">add</span>
                      Adicionar Móvel à Lista
                    </button>
                  </div>
                </div>

                {/* Render listed furniture items */}
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar">
                  {formFurniture.length === 0 ? (
                    <p className="text-xs text-slate-400/80 italic text-center py-2">Nenhum mobiliário anexado. Adicione itens acima.</p>
                  ) : (
                    formFurniture.map((item, index) => {
                      return (
                        <div key={item.id} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-white/5 border border-gray-150 dark:border-[#333] rounded-lg">
                          <span className="font-extrabold text-slate-700 dark:text-slate-350">{item.quantity}x {item.name} <span className="text-[10px] text-slate-400 font-normal">({item.condition})</span></span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFurnitureFromForm(item.id)}
                            className="text-red-500 hover:text-red-700 font-black p-1"
                            title="Remover móvel"
                          >
                            <span className="material-icons-outlined text-xs">delete</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Seção 4: Hóspedes / Colaboradores Residentes */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-black text-primary-600 dark:text-primary-400 tracking-wider block">4. Colaboradores Hospedados</span>
                  <span className="text-[10px] font-bold text-indigo-505 uppercase">Transferência Inteligente Auto-Sincronizada</span>
                </div>
                
                <p className="text-[11px] text-slate-400 leading-normal mb-2">
                  Selecione abaixo os colaboradores que irão permanecer nesta casa. Lembrete: Se um colaborador estiver marcado em outro alojamento, os sistemas farão a transferência de moradia automaticamente ao salvar.
                </p>

                <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar p-1">
                  {employees
                    .filter(emp => emp.status === 'Ativo' || emp.status === 'Férias')
                    .map(emp => {
                      const isChecked = selectedResidentIds.includes(emp.id);
                      const hostingInfo = getEmployeeHostingInfo(emp.id, editingProperty?.id);
                      
                      return (
                        <label 
                          key={emp.id} 
                          className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                            isChecked 
                              ? 'border-indigo-500 bg-indigo-55/5 dark:bg-indigo-950/20' 
                              : 'border-gray-150 dark:border-white/5 hover:bg-white dark:hover:bg-white/5 bg-white/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleResident(emp.id)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{emp.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{emp.role} — {emp.department}</span>
                            </div>
                          </div>
                          
                          <span className={`text-[9px] font-bold uppercase shrink-0 px-2 py-0.5 rounded-md ${
                            hostingInfo === 'Hospedado aqui'
                              ? 'bg-indigo-100 text-indigo-750 dark:bg-indigo-950 dark:text-indigo-300'
                              : hostingInfo.startsWith('Hospedado em')
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-400 dark:bg-white/5'
                          }`}>
                            {hostingInfo}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Seção 5: Observações adicionais */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Notas Gerais / Observações de Entrada</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Exemplo: Chave reserva deixada com o encarregado. Vistoria inicial sem problemas apontados."
                  className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-medium h-20"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-primary-650 hover:bg-primary-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-icons-outlined text-sm animate-spin">refresh</span>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined text-sm">save</span>
                      {editingProperty ? 'Salvar Alterações' : 'Salvar Imóvel'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Work Creation Nested Modal */}
      {showQuickWorkModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => setShowQuickWorkModal(false)}
          ></div>
          
          {/* Modal Container */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-md z-110 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col p-5">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 text-sm uppercase tracking-wider">
                <span className="material-icons-outlined text-primary-500">add_business</span>
                Cadastrar Nova Obra / Canteiro
              </h4>
              <button 
                type="button" 
                onClick={() => setShowQuickWorkModal(false)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200"
              >
                <span className="material-icons-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateQuickWork} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 mb-1 uppercase tracking-wider">Nome da Obra *</label>
                <input
                  type="text"
                  required
                  value={quickWorkName}
                  onChange={(e) => setQuickWorkName(e.target.value)}
                  placeholder="Ex: Edifício Bella Vista, Reforma Galpão Industrial"
                  className="w-full p-2.5 border border-gray-250 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 mb-1 uppercase tracking-wider">Tipo de Obra</label>
                  <select
                    value={quickWorkType}
                    onChange={(e) => setQuickWorkType(e.target.value as any)}
                    className="w-full p-2.5 border border-gray-250 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold"
                  >
                    <option value="Instalação" className="text-slate-800 dark:text-black">Instalação</option>
                    <option value="Manutenção" className="text-slate-800 dark:text-black">Manutenção</option>
                    <option value="Montagem" className="text-slate-800 dark:text-black">Montagem</option>
                    <option value="Desmontagem" className="text-slate-800 dark:text-black">Desmontagem</option>
                    <option value="Adequação" className="text-slate-800 dark:text-black">Adequação</option>
                    <option value="Outros" className="text-slate-800 dark:text-black">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 mb-1 uppercase tracking-wider">Status</label>
                  <select
                    value={quickWorkStatus}
                    onChange={(e) => setQuickWorkStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-gray-250 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold"
                  >
                    <option value="Planejado" className="text-slate-800 dark:text-black">Planejado</option>
                    <option value="Em Andamento" className="text-slate-800 dark:text-black">Em Andamento</option>
                    <option value="Pausado" className="text-slate-800 dark:text-black">Pausado</option>
                    <option value="Concluído" className="text-slate-800 dark:text-black">Concluído</option>
                    <option value="Atrasado" className="text-slate-800 dark:text-black">Atrasado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 mb-1 uppercase tracking-wider">Data de Início</label>
                  <input
                    type="date"
                    value={quickWorkStartDate}
                    onChange={(e) => setQuickWorkStartDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-250 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 mb-1 uppercase tracking-wider">Data Fim Est.</label>
                  <input
                    type="date"
                    value={quickWorkEndDate}
                    onChange={(e) => setQuickWorkEndDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-250 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowQuickWorkModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickWork}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-450 text-white rounded-lg font-bold flex items-center justify-center gap-1 shadow-sm"
                >
                  {isSavingQuickWork ? 'Salvando...' : 'Salvar Obra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-xl shadow-lg border border-slate-800 dark:border-slate-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
          <span className="material-icons-outlined text-primary-500">verified</span>
          <span className="text-xs font-bold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 dark:text-slate-550 hover:text-white dark:hover:text-slate-800 transition-colors ml-1.5">
            <span className="material-icons-outlined text-sm">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Properties;
