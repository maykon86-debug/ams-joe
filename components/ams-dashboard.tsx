'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, ChevronDown, Clock3, Eye, EyeOff, MoreHorizontal, Plus, Search, Settings, SlidersHorizontal, Trash2, Wrench, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Status = 'Distribuição' | 'Próximo atendimento' | 'Diagnóstico' | 'Aguardando aprovação' | 'Aguardando peças' | 'Em execução' | 'Inspeção final' | 'Finalizado'

type Vehicle = { id: string; plate: string; model: string; customer: string; technician: string; status: Status; age: string; service: string; overdue?: boolean }

const columns: Status[] = ['Distribuição', 'Próximo atendimento', 'Diagnóstico', 'Aguardando aprovação', 'Aguardando peças', 'Em execução', 'Inspeção final', 'Finalizado']
const accents = Array.from({ length: 8 }, () => '#e21b23')
type SlaTarget = { hours: number; minutes: number }
const defaultSla: Record<Status, SlaTarget> = {
  'Distribuição': { hours: 0, minutes: 0 },
  'Próximo atendimento': { hours: 0, minutes: 1 },
  'Diagnóstico': { hours: 1, minutes: 0 },
  'Aguardando aprovação': { hours: 4, minutes: 0 },
  'Aguardando peças': { hours: 8, minutes: 0 },
  'Em execução': { hours: 3, minutes: 0 },
  'Inspeção final': { hours: 0, minutes: 30 },
  'Finalizado': { hours: 0, minutes: 0 },
}
const initialVehicles: Vehicle[] = [
  { id: 'OS 567', plate: 'CVD-1142', model: 'VW GOL 2023', customer: 'JOAO', technician: 'Henry', status: 'Distribuição', age: '52h6min', service: 'Troca correia', overdue: true },
  { id: 'OS 524', plate: 'ASD-1A14', model: 'HONDA FIT 2012', customer: 'VITÓRIA', technician: 'Cleiton', status: 'Distribuição', age: '52h16min', service: 'Troca de oleo', overdue: true },
  { id: 'OS 1040', plate: 'AAS-1DER', model: 'CHEVROLET ONIX 2017', customer: 'Flávia Henriques', technician: 'Anderson', status: 'Aguardando aprovação', age: '45h21min', service: 'Troca de filtros', overdue: true },
  { id: 'OS 123', plate: 'ARZ-5I87', model: 'VOLVO XC60 2018', customer: 'Jonatas', technician: 'Fernando', status: 'Aguardando aprovação', age: '54h51min', service: 'Revisão' },
  { id: 'OS 781', plate: 'QWE-7K22', model: 'TOYOTA COROLLA 2021', customer: 'Mariana Costa', technician: 'Rafael', status: 'Em execução', age: '2h14min', service: 'Sistema de freios' },
  { id: 'OS 802', plate: 'BRT-3C90', model: 'JEEP COMPASS 2022', customer: 'Carlos Mendes', technician: 'Paulo', status: 'Inspeção final', age: '32min', service: 'Alinhamento' },
  { id: 'OS 744', plate: 'FHG-9L10', model: 'RENAULT KWID 2020', customer: 'Ana Paula', technician: 'Diego', status: 'Finalizado', age: '18min', service: 'Revisão geral' },
]

function VehicleCard({ vehicle, onOpen, onDragStart, onDelete, sla }: { vehicle: Vehicle; onOpen: (vehicle: Vehicle) => void; onDragStart: (vehicle: Vehicle) => void; onDelete: (vehicle: Vehicle) => void; sla: SlaTarget }) {
  const targetMinutes = sla.hours * 60 + sla.minutes
  const stageMinutes = vehicle.status === 'Aguardando aprovação' ? (vehicle.overdue ? targetMinutes + 1323 : 113) : vehicle.status === 'Inspeção final' ? 32 : 0
  const remaining = targetMinutes - stageMinutes
  const stageTimer = targetMinutes > 0 ? remaining < 0 ? `-${Math.floor(Math.abs(remaining) / 60).toString().padStart(2, '0')}:${(Math.abs(remaining) % 60).toString().padStart(2, '0')}h` : `${Math.floor(remaining / 60)}h${remaining % 60}min` : '—'
  return <button className={`vehicle-card ${vehicle.overdue ? 'is-overdue' : ''}`} draggable onDragStart={() => onDragStart(vehicle)} onClick={() => onOpen(vehicle)}>
    <div className="vehicle-card-top"><span className="plate"><small>BRASIL</small>{vehicle.plate}</span><span className="vehicle-card-actions"><span className="vehicle-id">{vehicle.id}</span>{vehicle.status === 'Finalizado' && <button type="button" className="delete-vehicle" aria-label={`Excluir ${vehicle.id}`} onClick={(event) => { event.stopPropagation(); onDelete(vehicle) }}><Trash2 aria-hidden="true" /></button>}</span></div>
    <div className="vehicle-info"><strong>{vehicle.model}</strong><span>{vehicle.customer}</span></div>
    <div className="technician"><Wrench aria-hidden="true" /> <strong>{vehicle.technician}</strong></div>
    <div className="vehicle-service">{vehicle.service}</div>
    <div className="vehicle-footer"><span><span className="footer-label">NO PÁTIO</span><b className="age"><Clock3 aria-hidden="true" />{vehicle.age}</b></span>{targetMinutes > 0 && <span><span className="footer-label">SLA DA ETAPA</span><b className={remaining < 0 ? 'age danger' : 'age ok'}>{stageTimer}</b></span>}</div>
  </button>
}

export function AmsDashboard() {
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isSlaOpen, setIsSlaOpen] = useState(false)
  const [slaTargets, setSlaTargets] = useState<Record<Status, SlaTarget>>(defaultSla)
  const [slaDraft, setSlaDraft] = useState<Record<Status, SlaTarget>>(defaultSla)
  const [search, setSearch] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('Todos')
  const [visibleColumns, setVisibleColumns] = useState<Status[]>(columns)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [draggedVehicle, setDraggedVehicle] = useState<Vehicle | null>(null)
  const [toast, setToast] = useState('')
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const technicians = useMemo(() => ['Todos', ...Array.from(new Set(vehicles.map((vehicle) => vehicle.technician)))], [vehicles])
  const supabase = useMemo(() => createClient(), [])
  const boardTable = useMemo(() => supabase.from('ams_board_state' as never) as any, [supabase])
  // The shared row and its RLS policies use the canonical default board id.
  const boardId = 'default'

  useEffect(() => {
    const updateClock = () => setCurrentTime(new Date())
    updateClock()
    const interval = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadBoard = async () => {
      const { data, error } = await boardTable
        .select('vehicles, sla_targets, visible_columns')
        .eq('id', boardId)
        .maybeSingle()

      if (!isMounted) return
      if (error) {
        console.error('[v0] Failed to load shared board state:', error)
      } else if (data) {
        if (Array.isArray(data.vehicles)) setVehicles(data.vehicles as Vehicle[])
        if (data.sla_targets && typeof data.sla_targets === 'object') setSlaTargets({ ...defaultSla, ...(data.sla_targets as Partial<Record<Status, SlaTarget>>) })
        if (Array.isArray(data.visible_columns) && data.visible_columns.length > 0) setVisibleColumns(data.visible_columns as Status[])
      }
      setHasLoadedStorage(true)
    }

    void loadBoard()
    return () => { isMounted = false }
  }, [boardId, boardTable])

  useEffect(() => {
    if (!hasLoadedStorage) return

    const channel = supabase
      .channel(`ams-board-state-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ams_board_state', filter: `id=eq.${boardId}` },
        (payload) => {
          const nextState = payload.new as {
            vehicles?: Vehicle[]
            sla_targets?: Record<Status, SlaTarget>
            visible_columns?: Status[]
          }

          if (payload.eventType === 'DELETE' || !nextState) return
          if (Array.isArray(nextState.vehicles)) setVehicles(nextState.vehicles)
          if (nextState.sla_targets && typeof nextState.sla_targets === 'object') {
            setSlaTargets({ ...defaultSla, ...nextState.sla_targets })
          }
          if (Array.isArray(nextState.visible_columns) && nextState.visible_columns.length > 0) {
            setVisibleColumns(nextState.visible_columns)
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[v0] Shared board realtime subscription failed:', status)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [boardId, hasLoadedStorage, supabase])

  useEffect(() => {
    if (!hasLoadedStorage) return
    const saveBoard = async () => {
      const { error } = await boardTable.upsert({
        id: boardId,
        vehicles,
        sla_targets: slaTargets,
        visible_columns: visibleColumns,
        updated_at: new Date().toISOString(),
      })
      if (error) console.error('[v0] Failed to save shared board state:', error)
    }
    void saveBoard()
  }, [boardId, boardTable, hasLoadedStorage, slaTargets, vehicles, visibleColumns])

  const deleteVehicle = (vehicle: Vehicle) => {
    setVehicles((items) => items.filter((item) => item.id !== vehicle.id))
    setToast(`${vehicle.id} excluída`)
    window.setTimeout(() => setToast(''), 2400)
  }
  const openSla = () => { setSlaDraft(slaTargets); setIsSlaOpen(true) }
  const saveSla = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setSlaTargets(slaDraft); setIsSlaOpen(false); setToast('Metas de tempo atualizadas'); window.setTimeout(() => setToast(''), 2400) }
  const filtered = useMemo(() => vehicles.filter((v) => `${v.plate} ${v.model} ${v.customer}`.toLowerCase().includes(search.toLowerCase()) && (technicianFilter === 'Todos' || v.technician === technicianFilter)), [vehicles, search, technicianFilter])
  const move = (status: Status, vehicle = selected) => { if (!vehicle || vehicle.status === status) return; setVehicles((items) => items.map((v) => v.id === vehicle.id ? { ...v, status, age: 'agora', overdue: false } : v)); setToast(`${vehicle.id} movida para ${status}`); setSelected(null); setDraggedVehicle(null); window.setTimeout(() => setToast(''), 2400) }
  const addVehicle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const vehicle: Vehicle = { id: `OS ${Math.floor(1000 + Math.random() * 9000)}`, plate: String(data.get('plate')).toUpperCase(), model: `${data.get('brand')} ${data.get('model')} ${data.get('year')}`, customer: String(data.get('customer')), technician: String(data.get('technician')), status: String(data.get('status')) as Status, age: 'agora', service: String(data.get('service')) }
    setVehicles((items) => [...items, vehicle]); setIsAdding(false); setToast(`${vehicle.id} adicionada à esteira`); window.setTimeout(() => setToast(''), 2400)
  }
  const updateVehicle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    const data = new FormData(event.currentTarget)
    const updated: Vehicle = { ...selected, plate: String(data.get('plate')).toUpperCase(), model: `${data.get('brand')} ${data.get('model')} ${data.get('year')}`, customer: String(data.get('customer')), technician: String(data.get('technician')), status: String(data.get('status')) as Status, service: String(data.get('service')) }
    setVehicles((items) => items.map((vehicle) => vehicle.id === selected.id ? updated : vehicle))
    setSelected(null)
    setToast(`${selected.id} atualizada`)
    window.setTimeout(() => setToast(''), 2400)
  }

  const liveHour = currentTime ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(currentTime) : '--:--'
  const liveDate = currentTime ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(currentTime) : 'Carregando data...'

  return <div className="app-shell"><header className="topbar"><div className="brand"><img className="brand-logo" src="/ams-mecanica-logo.png" alt="AMS Mecânica — Soluções Automotivas" /></div><div className="topbar-right"><div className="clock" aria-live="polite"><strong>{liveHour}</strong><span>{liveDate}</span></div><button className="top-icon" aria-label="Configurações" onClick={openSla}><Settings /></button><button className="top-icon" aria-label="Notificações"><Bell /></button></div></header>
    <main className="main-content"><div className="page-container"><div className="board-toolbar"><div><p className="eyebrow">OPERAÇÃO · VISÃO DO PÁTIO</p><h1>Fluxo do pátio</h1></div><div className="board-tools"><div className="search-box"><Search aria-hidden="true" /><input aria-label="Buscar veículo" placeholder="Buscar placa ou cliente" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className={`filter-button ${isFiltersOpen ? 'is-active' : ''}`} onClick={() => setIsFiltersOpen((open) => !open)}><SlidersHorizontal /> Filtros <ChevronDown /></button><button className="add-button" onClick={() => setIsAdding(true)}><Plus /> Nova OS</button></div></div>{isFiltersOpen && <div className="filters-panel"><div className="filter-group"><label htmlFor="technician-filter">Mecânico</label><select id="technician-filter" value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)}>{technicians.map((technician) => <option key={technician}>{technician}</option>)}</select></div><div className="column-visibility"><span>Colunas visíveis</span><div>{columns.map((column) => { const isVisible = visibleColumns.includes(column); return <button key={column} className={isVisible ? 'visibility-chip is-visible' : 'visibility-chip'} onClick={() => setVisibleColumns((current) => isVisible ? current.filter((item) => item !== column) : [...current, column])}>{isVisible ? <Eye /> : <EyeOff />} {column}</button> })}</div></div></div>}<div className="kanban-board">{columns.map((column, index) => { if (!visibleColumns.includes(column)) return null; const cards = filtered.filter((v) => v.status === column); return <section className="kanban-column" key={column} onDragOver={(event) => event.preventDefault()} onDrop={() => draggedVehicle && move(column, draggedVehicle)}><div className="column-heading" style={{ borderTopColor: accents[index] }}><h2>{column}</h2><span>{cards.length}</span></div><div className="column-cards">{cards.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} sla={slaTargets[vehicle.status]} onOpen={setSelected} onDragStart={setDraggedVehicle} onDelete={deleteVehicle} />)}{cards.length === 0 && <div className="empty-column">Solte uma OS aqui</div>}</div></section> })}</div></div></main>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><form className="new-os-modal detail-edit-modal" onSubmit={updateVehicle} onClick={(event) => event.stopPropagation()}><div className="new-os-header"><div><p className="modal-kicker">{selected.id} · {selected.status}</p><h2>Editar OS</h2></div><button type="button" className="modal-close" aria-label="Fechar" onClick={() => setSelected(null)}><X /></button></div><div className="form-field"><label htmlFor="edit-plate">PLACA</label><input id="edit-plate" name="plate" defaultValue={selected.plate} required /></div><div className="form-field"><label htmlFor="edit-number">NÚMERO DA OS</label><input id="edit-number" name="number" defaultValue={selected.id.replace('OS ', '')} readOnly /></div><div className="form-row"><div className="form-field"><label htmlFor="edit-brand">MARCA</label><input id="edit-brand" name="brand" defaultValue={selected.model.split(' ')[0]} required /></div><div className="form-field"><label htmlFor="edit-model">MODELO</label><input id="edit-model" name="model" defaultValue={selected.model.split(' ').slice(1, -1).join(' ')} required /></div><div className="form-field year-field"><label htmlFor="edit-year">ANO</label><input id="edit-year" name="year" defaultValue={selected.model.split(' ').at(-1)} required /></div></div><div className="form-field"><label htmlFor="edit-customer">CLIENTE</label><input id="edit-customer" name="customer" defaultValue={selected.customer} required /></div><div className="form-field"><label htmlFor="edit-service">SERVIÇO</label><textarea id="edit-service" name="service" defaultValue={selected.service} required /></div><div className="form-field"><label htmlFor="edit-technician">MECÂNICO RESPONSÁVEL</label><select id="edit-technician" name="technician" defaultValue={selected.technician} required>{technicians.filter((technician) => technician !== 'Todos').map((technician) => <option key={technician}>{technician}</option>)}</select></div><fieldset className="status-field"><legend>STATUS DA OS</legend><div className="status-options">{columns.map((status) => <label key={status} className={status === selected.status ? 'active' : ''}><input type="radio" name="status" value={status} defaultChecked={status === selected.status} /><span>{status}</span></label>)}</div></fieldset><div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setSelected(null)}>Cancelar</button><button type="submit" className="primary-action">Salvar alterações</button></div></form></div>}
    {isSlaOpen && <div className="modal-backdrop" onClick={() => setIsSlaOpen(false)}><form className="sla-modal" onSubmit={saveSla} onClick={(event) => event.stopPropagation()}><div className="new-os-header"><div><h2>Metas de tempo por etapa</h2><p>Defina o tempo esperado em cada etapa.</p></div><button type="button" className="modal-close" aria-label="Fechar" onClick={() => setIsSlaOpen(false)}><X /></button></div><div className="sla-list">{columns.map((column) => <div className="sla-row" key={column}><strong>{column}</strong><div className="sla-inputs"><input aria-label={`${column} horas`} type="number" min="0" value={slaDraft[column].hours} onChange={(event) => setSlaDraft((current) => ({ ...current, [column]: { ...current[column], hours: Number(event.target.value) } }))} /><span>h</span><input aria-label={`${column} minutos`} type="number" min="0" max="59" value={slaDraft[column].minutes} onChange={(event) => setSlaDraft((current) => ({ ...current, [column]: { ...current[column], minutes: Number(event.target.value) } }))} /><span>min</span></div></div>)}</div><div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setIsSlaOpen(false)}>Cancelar</button><button type="submit" className="primary-action">Salvar metas</button></div></form></div>}
    {isAdding && <div className="modal-backdrop" onClick={() => setIsAdding(false)}><form className="new-os-modal" onSubmit={addVehicle} onClick={(e) => e.stopPropagation()}><div className="new-os-header"><h2>Nova OS</h2><button type="button" className="modal-close" aria-label="Fechar" onClick={() => setIsAdding(false)}><X /></button></div><div className="form-field"><label htmlFor="plate">PLACA</label><input id="plate" name="plate" placeholder="ABC-1234" required /></div><div className="form-field"><label htmlFor="number">NÚMERO DA OS</label><input id="number" name="number" placeholder="Ex.: 1042" required /></div><div className="form-row"><div className="form-field"><label htmlFor="brand">MARCA</label><input id="brand" name="brand" placeholder="Ex.: Hyundai" required /></div><div className="form-field"><label htmlFor="model">MODELO</label><input id="model" name="model" placeholder="Ex.: HB20" required /></div><div className="form-field year-field"><label htmlFor="year">ANO</label><input id="year" name="year" placeholder="2019" required /></div></div><div className="form-field"><label htmlFor="customer">CLIENTE</label><input id="customer" name="customer" placeholder="Nome do cliente" required /></div><div className="form-field"><label htmlFor="service">SERVIÇO</label><textarea id="service" name="service" placeholder="Descrição do serviço solicitado" required /></div><div className="form-field"><label htmlFor="technician">MECÂNICO RESPONSÁVEL</label><select id="technician" name="technician" defaultValue="" required><option value="" disabled>Selecionar...</option><option>Henry</option><option>Cleiton</option><option>Anderson</option><option>Fernando</option><option>Rafael</option><option>Paulo</option><option>Diego</option></select></div><fieldset className="status-field"><legend>STATUS INICIAL</legend><div className="status-options">{columns.filter((status) => status !== 'Finalizado').map((status, index) => <label key={status} className={index === 0 ? 'active' : ''}><input type="radio" name="status" value={status} defaultChecked={index === 0} />{status}</label>)}</div></fieldset><div className="form-actions"><button type="button" className="cancel-button" onClick={() => setIsAdding(false)}>Cancelar</button><button type="submit" className="submit-button">Adicionar à esteira</button></div></form></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

export default AmsDashboard

void (null as never)
