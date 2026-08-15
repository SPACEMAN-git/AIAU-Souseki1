import type { Station, StationEdge } from '../lib/types'

/**
 * Demo station network for the Tokyo demo area.
 * Coordinates are approximate; inter-station minutes are average
 * scheduled times, NOT live timetable data.
 */
export const DEMO_STATIONS: Station[] = [
  { id: 'st_tokyo', name: '東京', operator: 'JR東日本', line: 'JR山手線/中央線', lat: 35.6812, lng: 139.7671 },
  { id: 'st_kanda', name: '神田', operator: 'JR東日本', line: 'JR山手線/中央線', lat: 35.6918, lng: 139.7709 },
  { id: 'st_ochanomizu', name: '御茶ノ水', operator: 'JR東日本', line: 'JR中央線', lat: 35.6994, lng: 139.7649 },
  { id: 'st_yotsuya', name: '四ツ谷', operator: 'JR東日本', line: 'JR中央線', lat: 35.6861, lng: 139.7301 },
  { id: 'st_shinjuku', name: '新宿', operator: 'JR東日本', line: 'JR山手線/中央線', lat: 35.6896, lng: 139.7006 },
  { id: 'st_nakano', name: '中野', operator: 'JR東日本', line: 'JR中央線', lat: 35.7056, lng: 139.6657 },
  { id: 'st_koenji', name: '高円寺', operator: 'JR東日本', line: 'JR中央線', lat: 35.7053, lng: 139.6497 },
  { id: 'st_asagaya', name: '阿佐ヶ谷', operator: 'JR東日本', line: 'JR中央線', lat: 35.7047, lng: 139.6358 },
  { id: 'st_ogikubo', name: '荻窪', operator: 'JR東日本', line: 'JR中央線', lat: 35.7047, lng: 139.6203 },
  { id: 'st_kichijoji', name: '吉祥寺', operator: 'JR東日本', line: 'JR中央線', lat: 35.7031, lng: 139.5797 },
  { id: 'st_mitaka', name: '三鷹', operator: 'JR東日本', line: 'JR中央線', lat: 35.7027, lng: 139.5608 },
  { id: 'st_yurakucho', name: '有楽町', operator: 'JR東日本', line: 'JR山手線', lat: 35.675, lng: 139.7631 },
  { id: 'st_shimbashi', name: '新橋', operator: 'JR東日本', line: 'JR山手線', lat: 35.6662, lng: 139.7583 },
  { id: 'st_hamamatsucho', name: '浜松町', operator: 'JR東日本', line: 'JR山手線', lat: 35.6554, lng: 139.757 },
  { id: 'st_shinagawa', name: '品川', operator: 'JR東日本', line: 'JR山手線', lat: 35.6285, lng: 139.7388 },
  { id: 'st_ebisu', name: '恵比寿', operator: 'JR東日本', line: 'JR山手線', lat: 35.6467, lng: 139.71 },
  { id: 'st_shibuya', name: '渋谷', operator: 'JR東日本', line: 'JR山手線', lat: 35.658, lng: 139.7016 },
  { id: 'st_harajuku', name: '原宿', operator: 'JR東日本', line: 'JR山手線', lat: 35.6702, lng: 139.7027 },
  { id: 'st_yoyogi', name: '代々木', operator: 'JR東日本', line: 'JR山手線', lat: 35.683, lng: 139.702 },
  { id: 'st_takadanobaba', name: '高田馬場', operator: 'JR東日本', line: 'JR山手線', lat: 35.7123, lng: 139.7038 },
  { id: 'st_ikebukuro', name: '池袋', operator: 'JR東日本', line: 'JR山手線', lat: 35.7295, lng: 139.7109 },
  { id: 'st_ueno', name: '上野', operator: 'JR東日本', line: 'JR山手線', lat: 35.7141, lng: 139.7774 },
  { id: 'st_akihabara', name: '秋葉原', operator: 'JR東日本', line: 'JR山手線', lat: 35.6984, lng: 139.7731 },
  { id: 'st_nakanosakaue', name: '中野坂上', operator: '東京メトロ', line: '丸ノ内線', lat: 35.6975, lng: 139.6824 },
  { id: 'st_nishishinjuku', name: '西新宿', operator: '東京メトロ', line: '丸ノ内線', lat: 35.6944, lng: 139.6926 },
]

const edge = (
  from: string,
  to: string,
  minutes: number,
  line: string,
  transfer = false,
): StationEdge => ({ from, to, minutes, line, transfer })

/** Bidirectional average inter-station travel times (demo data). */
export const DEMO_STATION_EDGES: StationEdge[] = [
  // JR Chuo line (rapid) Tokyo -> Mitaka
  edge('st_tokyo', 'st_kanda', 2, 'JR中央線'),
  edge('st_kanda', 'st_ochanomizu', 2, 'JR中央線'),
  edge('st_ochanomizu', 'st_yotsuya', 5, 'JR中央線'),
  edge('st_yotsuya', 'st_shinjuku', 5, 'JR中央線'),
  edge('st_shinjuku', 'st_nakano', 5, 'JR中央線'),
  edge('st_nakano', 'st_koenji', 2, 'JR中央線'),
  edge('st_koenji', 'st_asagaya', 2, 'JR中央線'),
  edge('st_asagaya', 'st_ogikubo', 2, 'JR中央線'),
  edge('st_ogikubo', 'st_kichijoji', 4, 'JR中央線'),
  edge('st_kichijoji', 'st_mitaka', 2, 'JR中央線'),
  // JR Yamanote line (partial loop)
  edge('st_tokyo', 'st_yurakucho', 2, 'JR山手線'),
  edge('st_yurakucho', 'st_shimbashi', 2, 'JR山手線'),
  edge('st_shimbashi', 'st_hamamatsucho', 3, 'JR山手線'),
  edge('st_hamamatsucho', 'st_shinagawa', 5, 'JR山手線'),
  edge('st_shinagawa', 'st_ebisu', 8, 'JR山手線'),
  edge('st_ebisu', 'st_shibuya', 2, 'JR山手線'),
  edge('st_shibuya', 'st_harajuku', 2, 'JR山手線'),
  edge('st_harajuku', 'st_yoyogi', 2, 'JR山手線'),
  edge('st_yoyogi', 'st_shinjuku', 2, 'JR山手線'),
  edge('st_shinjuku', 'st_takadanobaba', 4, 'JR山手線'),
  edge('st_takadanobaba', 'st_ikebukuro', 5, 'JR山手線'),
  edge('st_tokyo', 'st_kanda', 2, 'JR山手線'),
  edge('st_kanda', 'st_akihabara', 2, 'JR山手線'),
  edge('st_akihabara', 'st_ueno', 4, 'JR山手線'),
  // Marunouchi line segment (with transfers at Shinjuku/Nakano-sakaue)
  edge('st_shinjuku', 'st_nishishinjuku', 2, '丸ノ内線', true),
  edge('st_nishishinjuku', 'st_nakanosakaue', 2, '丸ノ内線'),
]
