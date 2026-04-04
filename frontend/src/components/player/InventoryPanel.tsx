import { useGameStore } from '../../store'
import type { ClientActionType } from '../../ws/messageTypes'

interface Props { dispatch: (type: ClientActionType, payload?: unknown) => void }

export default function InventoryPanel({ dispatch }: Props) {
  const inventory = useGameStore(s => s.inventory)
  const equipped = inventory.filter(i => i.slot)
  const carried = inventory.filter(i => !i.slot)

  return (
    <div className="box" style={{ flexShrink:0 }}>
      <div className="box-title">物品</div>
      {equipped.length > 0 && (
        <div style={{ marginBottom:6 }}>
          {equipped.map(i => (
            <div key={i.id} style={{ fontSize:12, color:'var(--accent)' }}>
              [{i.slot}] {i.name}
              <button style={{ marginLeft:6, fontSize:11, padding:'1px 5px' }} title={`MUD 指令: unequip ${i.name} / remove ${i.name}`}
                onClick={() => dispatch('EQUIP_ITEM', { itemId: i.itemId })}>卸下</button>
            </div>
          ))}
        </div>
      )}
      {carried.length === 0 ? <div style={{ color:'var(--text-dim)', fontSize:12 }}>無物</div> : (
        carried.map(i => (
          <div key={i.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'2px 0', borderBottom:'1px solid var(--border)' }}>
            <span>{i.name} ×{i.quantity}</span>
            <div style={{ display:'flex', gap:3 }}>
              {(i.type === 'sword' || i.type === 'armor' || i.type === 'blade' || i.type === 'cloth') && (
                <button style={{ fontSize:11, padding:'1px 5px' }} title={`MUD 指令: equip ${i.name} / wear ${i.name}`}
                  onClick={() => dispatch('EQUIP_ITEM', { itemId: i.itemId })}>裝備</button>
              )}
              {(i.type === 'food' || i.type === 'medicine') && (
                <button style={{ fontSize:11, padding:'1px 5px' }} title={`MUD 指令: use ${i.name}`}
                  onClick={() => dispatch('USE_ITEM', { itemId: i.itemId })}>使用</button>
              )}
              <button style={{ fontSize:11, padding:'1px 5px' }} title={`MUD 指令: drop ${i.name}`}
                onClick={() => dispatch('DROP_ITEM', { itemId: i.itemId })}>丟棄</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
