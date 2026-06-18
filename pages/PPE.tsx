
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

// Interfaces
interface Supplier {
  id?: number;
  tradeName: string;
  companyName: string;
  cnpj: string;
  ie: string;
  contactName: string;
  email: string;
  website: string;
  phone: string;
  cellphone: string;
  zipCode: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
}

interface PPEItem {
  id?: number;
  name: string;
  caNumber: string;
  stock: number;
  minStock: number;
  unit: string;
  expiryDate?: string;
  supplierId?: number; 
  manufacturer?: string; 
  description?: string; 
}

interface Delivery {
  id: number;
  type: 'SAIDA'; // Marcador de tipo
  employeeId: string;
  itemId: number;
  employeeName: string;
  itemName: string;
  quantity: number;
  date: string; // Display string
  isoDate: string; // Sorting
  reason?: string;
  signature?: string;
}

interface Return {
  id: number;
  type: 'ENTRADA'; // Marcador de tipo
  employeeId: string;
  itemId: number;
  employeeName: string;
  itemName: string;
  quantity: number;
  date: string; // Display string
  isoDate: string; // Sorting
  reason: string;
  restock: boolean;
  signature?: string;
}

// Union Type para Lista Unificada
type Movement = Delivery | Return;

// Motivos de Devolução e Lógica de Estoque
const RETURN_REASONS = [
    // Grupo A: Retorna ao Estoque
    { label: 'Desligamento / Rescisão', restock: true },
    { label: 'Troca de Função / Setor', restock: true },
    { label: 'Fim da Atividade / Obra', restock: true },
    { label: 'Tamanho Incorreto (Sem uso)', restock: true },
    { label: 'Férias / Afastamento', restock: true },
    { label: 'Higienização', restock: true },
    // Grupo B: Descarte / Baixa
    { label: 'Danificado / Quebrado', restock: false },
    { label: 'Desgaste Natural / Fim da Vida Útil', restock: false },
    { label: 'Vencido (Validade/CA)', restock: false },
    { label: 'Contaminado', restock: false },
    { label: 'Reprovação em Inspeção', restock: false },
    { label: 'Defeito de Fabricação', restock: false },
    { label: 'Perda / Extravio (Registro)', restock: false }
];

// Helper masks
const maskCNPJ = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 14) v = v.substring(0, 14);
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const maskPhone = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 10) return v.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  return v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
};

const maskCEP = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 8) v = v.substring(0, 8);
  return v.replace(/^(\d{5})(\d{3})/, "$1-$2");
};

// Helper: Calcula dias restantes e status
const getValidityStatus = (dateString?: string) => {
    if (!dateString) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Corrige fuso horário adicionando T00:00:00 se for YYYY-MM-DD
    const expiry = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = 'valid';
    let colorClass = 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    let icon = 'check_circle';
    let message = `${diffDays} dias restantes`;

    if (diffDays < 0) {
        status = 'expired';
        colorClass = 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
        icon = 'error';
        message = `Vencido há ${Math.abs(diffDays)} dias`;
    } else if (diffDays === 0) {
        status = 'warning';
        colorClass = 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
        icon = 'warning';
        message = 'Vence hoje!';
    } else if (diffDays <= 30) {
        status = 'warning';
        colorClass = 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
        icon = 'warning';
        message = `Vence em ${diffDays} dias`;
    }

    return { diffDays, status, colorClass, icon, message };
};

const PPE: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'MOVEMENTS' | 'SUPPLIERS'>('INVENTORY');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data States
  const [inventory, setInventory] = useState<PPEItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]); // Para o select de entrega
  
  // Supplier Modal States
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({});
  const [formErrors, setFormErrors] = useState<any>({});

  // Inventory Modal States
  const [showItemModal, setShowItemModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<PPEItem | null>(null);
  const [itemForm, setItemForm] = useState<Partial<PPEItem>>({});

  // Delivery Modal States
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [viewingMovement, setViewingMovement] = useState<Movement | null>(null);
  const [editingDeliveryId, setEditingDeliveryId] = useState<number | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
      employeeId: '',
      itemId: '',
      quantity: 1,
      reason: 'Primeira Entrega',
      date: new Date().toISOString().split('T')[0]
  });

  // Return Modal States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnForm, setReturnForm] = useState({
      employeeId: '',
      itemId: '',
      quantity: 1,
      reason: '',
      date: new Date().toISOString().split('T')[0]
  });
  
  // Signature Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  
  // Fetch Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
        // Suppliers
        const { data: suppData } = await supabase.from('ppe_suppliers').select('*').order('trade_name');
        if (suppData) {
            setSuppliers(suppData.map((s: any) => ({
                id: s.id,
                tradeName: s.trade_name,
                companyName: s.company_name,
                cnpj: s.cnpj,
                ie: s.ie,
                contactName: s.contact_name,
                email: s.email,
                website: s.website,
                phone: s.phone,
                cellphone: s.cellphone,
                zipCode: s.address_info?.cep || '',
                address: s.address_info?.rua || '',
                number: s.address_info?.numero || '',
                complement: s.address_info?.complemento || '',
                neighborhood: s.address_info?.bairro || '',
                city: s.address_info?.cidade || '',
                state: s.address_info?.uf || '',
                notes: s.notes
            })));
        }

        // Inventory
        const { data: invData } = await supabase.from('ppe_items').select('*').order('name');
        if (invData) {
            setInventory(invData.map((i: any) => ({
                id: i.id,
                name: i.name,
                caNumber: i.ca_number,
                stock: i.stock,
                minStock: i.min_stock,
                unit: i.unit,
                expiryDate: i.expiry_date,
                manufacturer: i.manufacturer || '',
                description: i.description || '',
                supplierId: i.supplier_id 
            })));
        }

        // Deliveries (Saídas)
        const { data: delData } = await supabase.from('ppe_deliveries').select('*');
        
        // Returns (Entradas) - Fallback safe if table doesn't exist yet
        const { data: retData, error: retError } = await supabase.from('ppe_returns').select('*');
        if (retError && retError.code !== 'PGRST116') {
             // Just ignore if table missing in dev, or log
             console.log("Tabela ppe_returns pode não existir ainda.");
        }

        // Combine Movements
        const combinedMovements: Movement[] = [];

        if (delData) {
            delData.forEach((d: any) => combinedMovements.push({
                type: 'SAIDA',
                id: d.id,
                employeeId: d.employee_id,
                itemId: d.item_id,
                employeeName: d.employee_name,
                itemName: d.item_name,
                quantity: d.quantity,
                reason: d.reason,
                date: new Date(d.delivery_date).toLocaleDateString('pt-BR'),
                isoDate: d.delivery_date, // for sorting
                signature: d.signature
            }));
        }

        if (retData) {
            retData.forEach((r: any) => combinedMovements.push({
                type: 'ENTRADA',
                id: r.id,
                employeeId: r.employee_id,
                itemId: r.item_id,
                employeeName: r.employee_name,
                itemName: r.item_name,
                quantity: r.quantity,
                reason: r.reason,
                restock: r.restock,
                date: new Date(r.return_date).toLocaleDateString('pt-BR'),
                isoDate: r.return_date, // for sorting
                signature: r.signature
            }));
        }

        // Sort by Date Descending
        setMovements(combinedMovements.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime()));

        // Employees (Simple list for dropdown)
        const { data: empData } = await supabase.from('employees').select('id, name, role').order('name');
        if (empData) {
            setEmployeesList(empData);
        }
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Limpa busca ao trocar de aba
  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  // --- Signature Canvas Logic ---
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent scrolling on touch devices
    if(e.type === 'touchmove') {
       // e.preventDefault(); 
    }

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
        setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
  };

  // --- SAVE DELIVERY ---
  const handleSaveDelivery = async () => {
      if (!deliveryForm.employeeId || !deliveryForm.itemId || !deliveryForm.quantity || !deliveryForm.reason) {
          alert("Preencha todos os campos obrigatórios.");
          return;
      }
      
      if (!signatureData) {
          alert("A assinatura do colaborador é obrigatória para conformidade com a NR-6.");
          return;
      }

      // Re-validate selection from current inventory state
      const selectedItem = inventory.find(i => i.id === Number(deliveryForm.itemId));
      const selectedEmployee = employeesList.find(e => e.id === deliveryForm.employeeId);

      if (!selectedItem || !selectedEmployee) {
          alert("Item ou Colaborador inválido. A lista será atualizada.");
          fetchData();
          return;
      }

      // Validação de Vencimento
      const validity = getValidityStatus(selectedItem.expiryDate);
      if (validity && validity.diffDays < 0) {
          if (!confirm(`ATENÇÃO: O item "${selectedItem.name}" está VENCIDO há ${Math.abs(validity.diffDays)} dias. Deseja continuar com a entrega mesmo assim?`)) {
              return;
          }
      }

      try {
          // Get User ID for audit
          const { data: { user } } = await supabase.auth.getUser();

          if (editingDeliveryId) {
              // UPDATE
              const { error: updateError } = await supabase.from('ppe_deliveries').update({
                  employee_id: selectedEmployee.id,
                  employee_name: selectedEmployee.name,
                  item_id: selectedItem.id,
                  item_name: selectedItem.name,
                  quantity: deliveryForm.quantity,
                  reason: deliveryForm.reason,
                  delivery_date: deliveryForm.date,
                  signature: signatureData
              }).eq('id', editingDeliveryId);

              if (updateError) throw updateError;
              alert("Entrega atualizada com sucesso!");

          } else {
              // INSERT
              if (selectedItem.stock < deliveryForm.quantity) {
                  alert(`Estoque insuficiente. Disponível: ${selectedItem.stock}`);
                  return;
              }

              const { error: delError } = await supabase.from('ppe_deliveries').insert([{
                  employee_id: selectedEmployee.id,
                  employee_name: selectedEmployee.name,
                  item_id: selectedItem.id,
                  item_name: selectedItem.name,
                  quantity: deliveryForm.quantity,
                  reason: deliveryForm.reason,
                  delivery_date: deliveryForm.date,
                  expiry_date: selectedItem.expiryDate || null, // Snapshot expiry
                  signature: signatureData,
                  user_id: user?.id // Snapshot who registered
              }]);

              if (delError) {
                  if (delError.code === '23503' || (delError.message && (delError.message.includes('foreign key constraint') || delError.message.includes('fkey')))) {
                      throw new Error("O item selecionado não existe mais no banco de dados. A lista foi atualizada.");
                  }
                  throw delError;
              }

              // Update Stock only on Insert
              const newStock = selectedItem.stock - deliveryForm.quantity;
              const { error: stockError } = await supabase.from('ppe_items').update({ stock: newStock }).eq('id', selectedItem.id);
              if (stockError) throw stockError;

              alert("Entrega registrada com sucesso!");
          }

          setShowDeliveryModal(false);
          setEditingDeliveryId(null);
          setDeliveryForm({ employeeId: '', itemId: '', quantity: 1, reason: 'Primeira Entrega', date: new Date().toISOString().split('T')[0] });
          setSignatureData(null);
          fetchData();

      } catch (error: any) {
          alert("Erro ao salvar entrega: " + error.message);
          if (error.message.includes('banco de dados') || error.code === '23503') {
              fetchData();
          }
      }
  };

  // --- SAVE RETURN ---
  const handleSaveReturn = async () => {
      if (!returnForm.employeeId || !returnForm.itemId || !returnForm.quantity || !returnForm.reason) {
          alert("Preencha todos os campos obrigatórios.");
          return;
      }

      if (!signatureData) {
          alert("A assinatura é obrigatória.");
          return;
      }

      const selectedItem = inventory.find(i => i.id === Number(returnForm.itemId));
      const selectedEmployee = employeesList.find(e => e.id === returnForm.employeeId);
      const selectedReason = RETURN_REASONS.find(r => r.label === returnForm.reason);

      if (!selectedItem || !selectedEmployee || !selectedReason) {
          alert("Dados inválidos. Verifique as seleções.");
          return;
      }

      try {
          const { data: { user } } = await supabase.auth.getUser();

          // 1. Insert Return Record
          const { error: retError } = await supabase.from('ppe_returns').insert([{
              employee_id: selectedEmployee.id,
              employee_name: selectedEmployee.name,
              item_id: selectedItem.id,
              item_name: selectedItem.name,
              quantity: returnForm.quantity,
              reason: returnForm.reason,
              restock: selectedReason.restock,
              return_date: returnForm.date,
              signature: signatureData,
              user_id: user?.id
          }]);

          if (retError) {
              if (retError.code === '42P01') {
                  throw new Error("A tabela 'ppe_returns' não existe. Execute o SQL fornecido.");
              }
              throw retError;
          }

          // 2. Conditional Stock Update
          if (selectedReason.restock) {
              const newStock = selectedItem.stock + returnForm.quantity;
              const { error: stockError } = await supabase.from('ppe_items').update({ stock: newStock }).eq('id', selectedItem.id);
              if (stockError) throw stockError;
          }

          alert(selectedReason.restock 
              ? "Devolução registrada e estoque atualizado!" 
              : "Devolução registrada (item descartado/baixado)."
          );

          setShowReturnModal(false);
          setReturnForm({ employeeId: '', itemId: '', quantity: 1, reason: '', date: new Date().toISOString().split('T')[0] });
          setSignatureData(null);
          fetchData();

      } catch (error: any) {
          alert("Erro ao salvar devolução: " + error.message);
      }
  };

  const handleEditDelivery = (delivery: Delivery) => {
      setEditingDeliveryId(delivery.id);
      const isoDate = delivery.isoDate.split('T')[0];

      setDeliveryForm({
          employeeId: delivery.employeeId,
          itemId: delivery.itemId.toString(),
          quantity: delivery.quantity,
          reason: delivery.reason || 'Primeira Entrega',
          date: isoDate
      });
      setSignatureData(delivery.signature || null);
      setShowDeliveryModal(true);
  };

  const handleDeleteMovement = async (movement: Movement) => {
      if (confirm(`Tem certeza que deseja excluir este registro de ${movement.type === 'SAIDA' ? 'entrega' : 'devolução'}? Isso NÃO irá reverter o estoque automaticamente nesta versão para evitar inconsistências.`)) {
          try {
              const table = movement.type === 'SAIDA' ? 'ppe_deliveries' : 'ppe_returns';
              const { error } = await supabase.from(table).delete().eq('id', movement.id);
              if (error) throw error;
              setMovements(prev => prev.filter(m => m.id !== movement.id || m.type !== movement.type));
          } catch (error: any) {
              alert("Erro ao excluir: " + error.message);
          }
      }
  };

  // --- Supplier Logic ---

  const validateSupplierForm = () => {
    const errors: any = {};
    if (!supplierForm.tradeName?.trim()) errors.tradeName = 'Nome Fantasia é obrigatório';
    if (!supplierForm.cnpj?.trim()) errors.cnpj = 'CNPJ é obrigatório';
    else if (supplierForm.cnpj.length < 14) errors.cnpj = 'CNPJ inválido';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSupplierCepBlur = async () => {
    const cep = supplierForm.zipCode?.replace(/\D/g, '');
    if (cep?.length !== 8) return;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (!data.erro) {
            setSupplierForm(prev => ({
                ...prev,
                address: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                state: data.uf
            }));
        }
    } catch (error) {
        console.error("Erro ao buscar CEP:", error);
    }
  };

  const handleSupplierSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSupplierForm()) return;

    const addressInfo = {
        cep: supplierForm.zipCode,
        rua: supplierForm.address,
        numero: supplierForm.number,
        complemento: supplierForm.complement,
        bairro: supplierForm.neighborhood,
        cidade: supplierForm.city,
        uf: supplierForm.state
    };

    const payload = {
        trade_name: supplierForm.tradeName,
        company_name: supplierForm.companyName,
        cnpj: supplierForm.cnpj,
        ie: supplierForm.ie,
        contact_name: supplierForm.contactName,
        email: supplierForm.email,
        website: supplierForm.website,
        phone: supplierForm.phone,
        cellphone: supplierForm.cellphone,
        notes: supplierForm.notes,
        address_info: addressInfo
    };

    try {
        if (supplierForm.id) {
            await supabase.from('ppe_suppliers').update(payload).eq('id', supplierForm.id);
        } else {
            await supabase.from('ppe_suppliers').insert([payload]);
        }
        setShowSupplierModal(false);
        setSupplierForm({});
        setFormErrors({});
        fetchData();
    } catch (error: any) {
        alert("Erro ao salvar: " + error.message);
    }
  };

  const handleDeleteSupplier = async (id: number) => {
      if (confirm("Tem certeza que deseja excluir este fornecedor?")) {
          try {
              const { error } = await supabase.from('ppe_suppliers').delete().eq('id', id);
              if (error) throw error;
              setSuppliers(prev => prev.filter(s => s.id !== id));
          } catch (error: any) {
              alert("Erro ao excluir (pode estar vinculado a um item): " + error.message);
          }
      }
  };

  // --- Inventory Logic ---

  const handleOpenItemModal = (item?: PPEItem) => {
      if (item) {
          setItemForm(item);
      } else {
          setItemForm({ unit: 'un', minStock: 5, stock: 0, manufacturer: '', description: '', supplierId: undefined }); 
      }
      setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!itemForm.name || !itemForm.caNumber) {
          alert("Nome e CA são obrigatórios.");
          return;
      }

      const payload = {
          name: itemForm.name,
          ca_number: itemForm.caNumber,
          stock: itemForm.stock,
          min_stock: itemForm.minStock,
          unit: itemForm.unit,
          expiry_date: itemForm.expiryDate || null,
          manufacturer: itemForm.manufacturer,
          description: itemForm.description,
          supplier_id: itemForm.supplierId || null 
      };

      try {
          if (itemForm.id) {
              await supabase.from('ppe_items').update(payload).eq('id', itemForm.id);
          } else {
              await supabase.from('ppe_items').insert([payload]);
          }
          setShowItemModal(false);
          fetchData();
      } catch(error: any) {
          alert("Erro ao salvar item: " + error.message);
      }
  };

  const handleDeleteItem = async (id: number) => {
      if(confirm("Tem certeza que deseja excluir este item do estoque?")) {
          await supabase.from('ppe_items').delete().eq('id', id);
          fetchData();
      }
  };

  // --- Renders ---

  // Variáveis para renderização dinâmica dentro do Modal de Entrega
  const selectedItemForDelivery = inventory.find(i => i.id === Number(deliveryForm.itemId));
  const validityInfoDelivery = selectedItemForDelivery ? getValidityStatus(selectedItemForDelivery.expiryDate) : null;

  // Variáveis para renderização dinâmica dentro do Modal de Cadastro de Item
  const validityInfoItem = getValidityStatus(itemForm.expiryDate);

  // Variável para Modal de Devolução
  const selectedReasonForReturn = RETURN_REASONS.find(r => r.label === returnForm.reason);

  const renderInventory = () => (
      <div className="animate-in fade-in duration-300">
          <div className="flex justify-between mb-4">
              <h3 className="text-lg font-bold dark:text-white">Itens em Estoque</h3>
              <button 
                onClick={() => handleOpenItemModal()}
                className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2 shadow-sm"
              >
                  <span className="material-icons-outlined text-sm">add</span> Novo Item
              </button>
          </div>
          {inventory.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-white/5 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                  <span className="material-icons-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                  <p>Nenhum item cadastrado no estoque.</p>
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventory.map(item => {
                      const validity = getValidityStatus(item.expiryDate);
                      const supplier = suppliers.find(s => s.id === item.supplierId);
                      
                      return (
                      <div key={item.id} className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border hover:shadow-md transition-shadow relative group">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-base truncate pr-2 max-w-[200px]" title={item.name}>{item.name}</h4>
                                {item.manufacturer && <p className="text-xs text-slate-500 dark:text-slate-400">{item.manufacturer}</p>}
                              </div>
                              {item.stock <= item.minStock && (
                                  <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 shrink-0">
                                      <span className="material-icons-outlined text-[10px]">warning</span> Baixo
                                  </span>
                              )}
                          </div>
                          
                          <div className="text-sm text-slate-500 dark:text-slate-400 space-y-2 mt-3">
                              <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-2 rounded-lg">
                                  <span className="text-xs uppercase font-medium">Estoque</span>
                                  <span className={`font-bold ${item.stock <= item.minStock ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                      {item.stock} {item.unit}
                                  </span>
                              </div>
                              
                              <div className="flex items-center justify-between gap-2">
                                  <p className="flex-1 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 truncate" title="Número C.A.">
                                      <span className="material-icons-outlined text-[12px]">verified</span> 
                                      CA: <strong>{item.caNumber}</strong>
                                  </p>
                                  
                                  {validity && (
                                      <span 
                                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 border whitespace-nowrap ${validity.colorClass}`}
                                          title={item.expiryDate ? `Vencimento: ${new Date(item.expiryDate).toLocaleDateString('pt-BR')}` : ''}
                                      >
                                          <span className="material-icons-outlined text-[12px]">{validity.icon}</span>
                                          {validity.status === 'valid' && item.expiryDate
                                              ? new Date(item.expiryDate).toLocaleDateString('pt-BR')
                                              : validity.message}
                                      </span>
                                  )}
                              </div>
                          </div>

                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white dark:bg-dark-card rounded-lg shadow-sm p-1 border border-gray-100 dark:border-gray-700">
                              <button onClick={() => setViewingItem(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Visualizar">
                                  <span className="material-icons-outlined text-sm">visibility</span>
                              </button>
                              <button onClick={() => handleOpenItemModal(item)} className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors" title="Editar">
                                  <span className="material-icons-outlined text-sm">edit</span>
                              </button>
                              <button onClick={() => item.id && handleDeleteItem(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Excluir">
                                  <span className="material-icons-outlined text-sm">delete</span>
                              </button>
                          </div>
                      </div>
                  )})}
              </div>
          )}
      </div>
  );

  const renderMovements = () => {
      const filteredMovements = movements.filter(m => 
          m.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.date.includes(searchTerm)
      );

      return (
      <div className="animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <div className="relative flex-1 w-full md:w-auto">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por colaborador, item ou data..." 
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => {
                        setReturnForm({ employeeId: '', itemId: '', quantity: 1, reason: '', date: new Date().toISOString().split('T')[0] });
                        setSignatureData(null);
                        setShowReturnModal(true);
                    }}
                    className="flex-1 md:flex-none bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                      <span className="material-icons-outlined text-sm text-red-500">keyboard_return</span>
                      Registrar Devolução
                  </button>
                  <button 
                    onClick={async () => { 
                        setIsLoading(true);
                        await fetchData();
                        setEditingDeliveryId(null);
                        setShowDeliveryModal(true); 
                        setSignatureData(null); 
                        setIsLoading(false);
                    }}
                    disabled={isLoading}
                    className="flex-1 md:flex-none bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                      {isLoading ? <span className="material-icons-outlined text-sm animate-spin">refresh</span> : <span className="material-icons-outlined text-sm">edit_document</span>}
                      Nova Entrega
                  </button>
              </div>
          </div>

          <div className="overflow-x-auto bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-white/5 uppercase text-xs text-slate-500 dark:text-slate-400">
                      <tr>
                          <th className="px-6 py-4 text-center w-10">Tipo</th>
                          <th className="px-6 py-4">Data</th>
                          <th className="px-6 py-4">Colaborador</th>
                          <th className="px-6 py-4">EPI / Item</th>
                          <th className="px-6 py-4">Motivo</th>
                          <th className="px-6 py-4 text-center">Assinatura</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                      {filteredMovements.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
                      ) : filteredMovements.map(m => (
                          <tr key={`${m.type}-${m.id}`} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 text-center">
                                  {m.type === 'SAIDA' ? (
                                      <span className="material-icons-outlined text-green-500" title="Entrega (Saída do Estoque)">arrow_circle_up</span>
                                  ) : (
                                      <span className={`material-icons-outlined ${ (m as Return).restock ? 'text-blue-500' : 'text-red-500'}`} title={ (m as Return).restock ? "Devolução (Retorno ao Estoque)" : "Devolução (Descarte/Baixa)" }>
                                          {(m as Return).restock ? 'arrow_circle_down' : 'delete_forever'}
                                      </span>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{m.date}</td>
                              <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">{m.employeeName}</td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{m.quantity}x {m.itemName}</td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs max-w-[150px] truncate" title={m.reason}>{m.reason || '-'}</td>
                              <td className="px-6 py-4 text-center">
                                  {m.signature ? (
                                      <div className="h-8 w-16 mx-auto border border-gray-200 dark:border-gray-600 rounded bg-white overflow-hidden flex items-center justify-center">
                                          <img src={m.signature} alt="Assinatura" className="max-h-full max-w-full" />
                                      </div>
                                  ) : (
                                      <span className="text-xs text-slate-400 italic">Pendente</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => setViewingMovement(m)} 
                                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" 
                                        title="Visualizar Detalhes"
                                      >
                                          <span className="material-icons-outlined text-lg">visibility</span>
                                      </button>
                                      {/* Apenas entregas podem ser editadas para manter consistência do estoque complexo de devolução */}
                                      {m.type === 'SAIDA' && (
                                          <button 
                                            onClick={() => handleEditDelivery(m as Delivery)} 
                                            className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors" 
                                            title="Editar Entrega"
                                          >
                                              <span className="material-icons-outlined text-lg">edit</span>
                                          </button>
                                      )}
                                      <button 
                                        onClick={() => handleDeleteMovement(m)} 
                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" 
                                        title="Excluir Registro"
                                      >
                                          <span className="material-icons-outlined text-lg">delete</span>
                                      </button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
  )};

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold dark:text-white">Controle de EPIs</h2>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
          <button 
            className={`px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'SUPPLIERS' ? 'border-primary-500 text-primary-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            onClick={() => setActiveTab('SUPPLIERS')}
          >
              Fornecedores
          </button>
          <button 
            className={`px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'INVENTORY' ? 'border-primary-500 text-primary-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            onClick={() => setActiveTab('INVENTORY')}
          >
              Estoque de EPIs
          </button>
          <button 
            className={`px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'MOVEMENTS' ? 'border-primary-500 text-primary-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            onClick={() => setActiveTab('MOVEMENTS')}
          >
              Histórico de Movimentações
          </button>
      </div>

      {activeTab === 'INVENTORY' && renderInventory()}
      {activeTab === 'MOVEMENTS' && renderMovements()}
      
      {activeTab === 'SUPPLIERS' && (
          <div className="animate-in fade-in duration-300">
              <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold dark:text-white">Lista de Fornecedores</h3>
                  <button 
                    onClick={() => { setSupplierForm({}); setFormErrors({}); setShowSupplierModal(true); }}
                    className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2 shadow-sm"
                  >
                      <span className="material-icons-outlined text-sm">add</span> Novo Fornecedor
                  </button>
              </div>
              <div className="overflow-x-auto bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 dark:bg-white/5 uppercase text-xs text-slate-500 dark:text-slate-400">
                          <tr>
                              <th className="px-6 py-4">Nome Fantasia</th>
                              <th className="px-6 py-4">CNPJ</th>
                              <th className="px-6 py-4">Contato</th>
                              <th className="px-6 py-4">Telefone</th>
                              <th className="px-6 py-4 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                          {suppliers.map(sup => (
                              <tr key={sup.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">{sup.tradeName}</td>
                                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{sup.cnpj}</td>
                                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{sup.contactName}</td>
                                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{sup.phone || sup.cellphone}</td>
                                  <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end gap-2">
                                        <button onClick={() => setViewingSupplier(sup)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1.5 rounded transition-colors" title="Visualizar"><span className="material-icons-outlined text-lg">visibility</span></button>
                                        <button onClick={() => { setSupplierForm(sup); setShowSupplierModal(true); }} className="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 p-1.5 rounded transition-colors" title="Editar"><span className="material-icons-outlined text-lg">edit</span></button>
                                        <button onClick={() => sup.id && handleDeleteSupplier(sup.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded transition-colors" title="Excluir"><span className="material-icons-outlined text-lg">delete</span></button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- MODAL NOVA/EDITAR ENTREGA (COM ASSINATURA) --- */}
      {showDeliveryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col max-h-[95vh]">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-white/5 rounded-t-xl">
                    <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <span className="material-icons-outlined text-primary-500">assignment_turned_in</span>
                        {editingDeliveryId ? 'Editar Entrega' : 'Registrar Entrega de EPI'}
                    </h3>
                    <button onClick={() => setShowDeliveryModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Colaborador</label>
                        <select 
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={deliveryForm.employeeId}
                            onChange={e => setDeliveryForm({...deliveryForm, employeeId: e.target.value})}
                        >
                            <option value="">Selecione o Colaborador...</option>
                            {employeesList.map(e => (
                                <option key={e.id} value={e.id}>{e.name} - {e.role}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">EPI / Item</label>
                            <select 
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={deliveryForm.itemId}
                                onChange={e => setDeliveryForm({...deliveryForm, itemId: e.target.value})}
                            >
                                <option value="">Selecione o Item...</option>
                                {inventory.map(i => (
                                    <option key={i.id} value={i.id} disabled={i.stock <= 0}>
                                        {i.name} (Estoque: {i.stock})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd.</label>
                            <input 
                                type="number"
                                min="1"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={deliveryForm.quantity}
                                onChange={e => setDeliveryForm({...deliveryForm, quantity: parseInt(e.target.value) || 1})}
                            />
                        </div>
                    </div>

                    {/* Novo Campo: Motivo da Entrega */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo da Entrega (NR-6)</label>
                        <select 
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={deliveryForm.reason}
                            onChange={e => setDeliveryForm({...deliveryForm, reason: e.target.value})}
                        >
                            <option value="Primeira Entrega">Primeira Entrega</option>
                            <option value="Substituição por Perda">Substituição por Perda/Extravio</option>
                            <option value="Substituição por Dano">Substituição por Dano/Desgaste</option>
                            <option value="Substituição por Validade">Substituição por Validade</option>
                            <option value="Higienização">Devolução para Higienização</option>
                        </select>
                    </div>

                    {/* ALERTA DE VALIDADE NO REGISTRO DA ENTREGA */}
                    {validityInfoDelivery && (
                        <div className={`p-3 rounded-lg border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${validityInfoDelivery.colorClass}`}>
                            <span className="material-icons-outlined text-xl">{validityInfoDelivery.icon}</span>
                            <div>
                                <p className="text-sm font-bold uppercase">Atenção à Validade</p>
                                <p className="text-sm">
                                    Vencimento do CA: <strong>{new Date(selectedItemForDelivery!.expiryDate!).toLocaleDateString('pt-BR')}</strong>
                                    <br />
                                    <span className="font-semibold">{validityInfoDelivery.message}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data da Entrega</label>
                        <input 
                            type="date"
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={deliveryForm.date}
                            onChange={e => setDeliveryForm({...deliveryForm, date: e.target.value})}
                        />
                    </div>

                    {/* ASSINATURA DIGITAL */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-slate-800 dark:text-white">
                                Assinatura do Colaborador
                            </label>
                            <button 
                                onClick={clearSignature}
                                className="text-xs text-red-500 hover:underline flex items-center gap-1"
                            >
                                <span className="material-icons-outlined text-xs">delete</span> Limpar
                            </button>
                        </div>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-white/5 touch-none relative h-40">
                            <canvas 
                                ref={canvasRef}
                                width={450}
                                height={160}
                                className="w-full h-full cursor-crosshair"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                            {!isDrawing && !signatureData && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                                    <span className="text-slate-400">Assine aqui na tela</span>
                                </div>
                            )}
                            {signatureData && !isDrawing && (
                                 <img src={signatureData} alt="Assinatura Atual" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                            )}
                        </div>
                        
                        {/* Termo de Responsabilidade - NR-6 */}
                        <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 bg-gray-50 dark:bg-white/5 p-2 rounded border border-gray-100 dark:border-white/5">
                            <strong>Termo de Responsabilidade (NR-6):</strong>
                            <p className="mt-1 leading-relaxed">
                                Declaro ter recebido o EPI acima descrito em perfeito estado de conservação e funcionamento. 
                                Comprometo-me a utilizá-lo apenas para a finalidade a que se destina, responsabilizando-me por sua guarda e conservação, e a comunicar imediatamente qualquer alteração que o torne impróprio para uso.
                                Estou ciente de que o não cumprimento destas normas poderá acarretar sanções disciplinares.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-white/5 rounded-b-xl flex justify-end gap-3">
                    <button type="button" onClick={() => setShowDeliveryModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 transition-colors font-medium">Cancelar</button>
                    <button type="button" onClick={handleSaveDelivery} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-lg shadow-primary-500/30 transition-colors font-medium flex items-center gap-2">
                        <span className="material-icons-outlined text-sm">save</span> {editingDeliveryId ? 'Salvar Alterações' : 'Confirmar Entrega'}
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* --- MODAL DEVOLUÇÃO (NOVO) --- */}
      {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col max-h-[95vh]">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-red-50 dark:bg-red-900/10 rounded-t-xl">
                    <h3 className="text-xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                        <span className="material-icons-outlined">keyboard_return</span>
                        Registrar Devolução de EPI
                    </h3>
                    <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Colaborador</label>
                        <select 
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={returnForm.employeeId}
                            onChange={e => setReturnForm({...returnForm, employeeId: e.target.value})}
                        >
                            <option value="">Selecione o Colaborador...</option>
                            {employeesList.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Item Devolvido</label>
                            <select 
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={returnForm.itemId}
                                onChange={e => setReturnForm({...returnForm, itemId: e.target.value})}
                            >
                                <option value="">Selecione o Item...</option>
                                {inventory.map(i => (
                                    <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd.</label>
                            <input 
                                type="number"
                                min="1"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={returnForm.quantity}
                                onChange={e => setReturnForm({...returnForm, quantity: parseInt(e.target.value) || 1})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo da Devolução</label>
                        <select 
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={returnForm.reason}
                            onChange={e => setReturnForm({...returnForm, reason: e.target.value})}
                        >
                            <option value="">Selecione o motivo...</option>
                            {RETURN_REASONS.map(r => (
                                <option key={r.label} value={r.label}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Lógica Visual de Estoque */}
                    {selectedReasonForReturn && (
                        <div className={`p-3 rounded-lg border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                            selectedReasonForReturn.restock 
                            ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                            : 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300'
                        }`}>
                            <span className="material-icons-outlined text-xl mt-0.5">
                                {selectedReasonForReturn.restock ? 'inventory' : 'delete_forever'}
                            </span>
                            <div>
                                <p className="text-sm font-bold uppercase">
                                    {selectedReasonForReturn.restock ? 'Retorno ao Estoque' : 'Descarte / Baixa'}
                                </p>
                                <p className="text-xs mt-1">
                                    {selectedReasonForReturn.restock 
                                        ? 'O item será somado ao estoque disponível para uso por outro colaborador.'
                                        : 'O item será considerado impróprio para uso e não voltará ao estoque.'}
                                </p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data da Devolução</label>
                        <input 
                            type="date"
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={returnForm.date}
                            onChange={e => setReturnForm({...returnForm, date: e.target.value})}
                        />
                    </div>

                    {/* ASSINATURA DIGITAL */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-slate-800 dark:text-white">
                                Assinatura do Colaborador (Devolução)
                            </label>
                            <button 
                                onClick={clearSignature}
                                className="text-xs text-red-500 hover:underline flex items-center gap-1"
                            >
                                <span className="material-icons-outlined text-xs">delete</span> Limpar
                            </button>
                        </div>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-white/5 touch-none relative h-40">
                            <canvas 
                                ref={canvasRef}
                                width={450}
                                height={160}
                                className="w-full h-full cursor-crosshair"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                            {!isDrawing && !signatureData && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                                    <span className="text-slate-400">Assine aqui na tela</span>
                                </div>
                            )}
                            {signatureData && !isDrawing && (
                                 <img src={signatureData} alt="Assinatura Atual" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                            )}
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400 italic">
                            O colaborador atesta a devolução do item acima nas condições informadas.
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-white/5 rounded-b-xl flex justify-end gap-3">
                    <button type="button" onClick={() => setShowReturnModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 transition-colors font-medium">Cancelar</button>
                    <button type="button" onClick={handleSaveReturn} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg shadow-red-500/30 transition-colors font-medium flex items-center gap-2">
                        <span className="material-icons-outlined text-sm">save</span> Confirmar Devolução
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* --- MODAL VISUALIZAÇÃO MOVIMENTO (UNIFICADO) --- */}
      {viewingMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col">
                <div className={`p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center ${viewingMovement.type === 'SAIDA' ? 'bg-gray-50 dark:bg-white/5' : 'bg-red-50 dark:bg-red-900/10'} rounded-t-xl`}>
                    <h3 className={`text-xl font-bold flex items-center gap-2 ${viewingMovement.type === 'SAIDA' ? 'text-slate-800 dark:text-white' : 'text-red-700 dark:text-red-400'}`}>
                        <span className="material-icons-outlined">
                            {viewingMovement.type === 'SAIDA' ? 'assignment_turned_in' : 'keyboard_return'}
                        </span>
                        Detalhes da {viewingMovement.type === 'SAIDA' ? 'Entrega' : 'Devolução'}
                    </h3>
                    <button onClick={() => setViewingMovement(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Colaborador</p>
                            <p className="text-slate-800 dark:text-white">{viewingMovement.employeeName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Data</p>
                            <p className="text-slate-800 dark:text-white">{viewingMovement.date}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Item</p>
                            <p className="text-slate-800 dark:text-white">{viewingMovement.itemName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Quantidade</p>
                            <p className="text-slate-800 dark:text-white">{viewingMovement.quantity}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-xs text-slate-500 uppercase font-bold">Motivo</p>
                            <p className="text-slate-800 dark:text-white">{viewingMovement.reason || '-'}</p>
                        </div>
                        {viewingMovement.type === 'ENTRADA' && (
                            <div className="col-span-2">
                                <p className="text-xs text-slate-500 uppercase font-bold">Destino do Item</p>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold mt-1 ${ (viewingMovement as Return).restock ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700' }`}>
                                    <span className="material-icons-outlined text-sm">{(viewingMovement as Return).restock ? 'inventory' : 'delete'}</span>
                                    {(viewingMovement as Return).restock ? 'Retornou ao Estoque' : 'Descartado / Baixado'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                        <p className="text-xs text-slate-500 uppercase font-bold mb-2">Assinatura Digital</p>
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-white/5 flex items-center justify-center min-h-[120px]">
                            {viewingMovement.signature ? (
                                <img src={viewingMovement.signature} alt="Assinatura" className="max-w-full max-h-[150px]" />
                            ) : (
                                <span className="text-slate-400 italic">Sem assinatura registrada</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-white/5 rounded-b-xl flex justify-end">
                    <button onClick={() => setViewingMovement(null)} className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 font-medium transition-colors">
                        Fechar
                    </button>
                </div>
             </div>
        </div>
      )}

      {/* --- MODAL ITEM DE ESTOQUE (MANTIDO) --- */}
      {showItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-white/5 rounded-t-xl">
                    <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <span className="material-icons-outlined text-primary-500">inventory_2</span>
                        {itemForm.id ? 'Editar Item de Estoque' : 'Novo Item de Estoque'}
                    </h3>
                    <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>
                
                <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Certificado de Aprovação (C.A.)</label>
                        <input 
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono" 
                            value={itemForm.caNumber || ''} 
                            onChange={e => setItemForm({...itemForm, caNumber: e.target.value})} 
                            placeholder="Ex: 12345"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Equipamento *</label>
                        <input 
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" 
                            value={itemForm.name || ''} 
                            onChange={e => setItemForm({...itemForm, name: e.target.value})} 
                            placeholder="Ex: Luva de Raspa Cano Longo"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fabricante</label>
                            <input 
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" 
                                value={itemForm.manufacturer || ''} 
                                onChange={e => setItemForm({...itemForm, manufacturer: e.target.value})} 
                                placeholder="Marca / Fabricante"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fornecedor Principal</label>
                            <select 
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={itemForm.supplierId || ''}
                                onChange={e => setItemForm({...itemForm, supplierId: Number(e.target.value) || undefined})}
                            >
                                <option value="">Selecione...</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.tradeName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
                            <select 
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" 
                                value={itemForm.unit || 'un'} 
                                onChange={e => setItemForm({...itemForm, unit: e.target.value})}
                            >
                                <option value="un">Un (Unidade)</option>
                                <option value="par">Par</option>
                                <option value="cx">Caixa</option>
                                <option value="kg">Kg</option>
                                <option value="lt">Litro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estoque Atual</label>
                            <input 
                                type="number"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" 
                                value={itemForm.stock || 0} 
                                onChange={e => setItemForm({...itemForm, stock: parseInt(e.target.value) || 0})} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estoque Mín.</label>
                            <input 
                                type="number"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" 
                                value={itemForm.minStock || 0} 
                                onChange={e => setItemForm({...itemForm, minStock: parseInt(e.target.value) || 0})} 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Validade do C.A.</label>
                        <input 
                            type="date" 
                            className={`w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${itemForm.expiryDate && new Date(itemForm.expiryDate) < new Date() ? 'border-red-500 text-red-600' : ''}`}
                            value={itemForm.expiryDate || ''} 
                            onChange={e => setItemForm({...itemForm, expiryDate: e.target.value})} 
                        />
                        {/* ALERTA DE VALIDADE NO CADASTRO DE ITEM */}
                        {validityInfoItem && (
                            <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${validityInfoItem.colorClass.split(' ')[0]}`}>
                                <span className="material-icons-outlined text-sm">{validityInfoItem.icon}</span>
                                {validityInfoItem.message}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição / Detalhes</label>
                        <textarea 
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-[#121212] dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" 
                            value={itemForm.description || ''} 
                            onChange={e => setItemForm({...itemForm, description: e.target.value})} 
                            placeholder="Informações adicionais sobre o EPI..."
                        />
                    </div>
                </form>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-white/5 rounded-b-xl flex justify-end gap-3">
                    <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 transition-colors font-medium">Cancelar</button>
                    <button type="button" onClick={handleSaveItem} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-lg shadow-primary-500/30 transition-colors font-medium flex items-center gap-2">
                        <span className="material-icons-outlined text-sm">save</span> Salvar Item
                    </button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default PPE;
