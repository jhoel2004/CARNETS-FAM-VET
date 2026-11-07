/* ============================================================
   Ubicaciones de Bolivia: departamentos y municipios.
   Estructura ampliable: agregar nuevos municipios al array
   correspondiente sin tocar otra lógica.
   Fuente: divisiones administrativas oficiales de Bolivia.
   ============================================================ */
export const BOLIVIA_LOCATIONS = {
  'La Paz': [
    'La Paz', 'El Alto', 'Viacha', 'Achocalla', 'Copacabana', 'Caranavi',
    'Patacamaya', 'Tiwanaku', 'Laja', 'Achacachi', 'Sorata', 'Coroico',
    'Chulumani', 'Yungas', 'Apolo', 'Irupana', 'Yanacachi', 'Mecapaca',
    'Palca', 'Pucarani', 'Batallas', 'Puerto Pérez', 'Huarina',
    'Tiahuanaco', 'Desaguadero', 'Guaqui', 'Jesús de Machaca',
    'Taraco', 'Huatajata', 'Escoma', 'Charazani', 'Aucapata',
    'Curva', 'Pelechuco', 'Mapiri', 'Apolo', 'Ixiamas', 'San Buenaventura',
    'Rurrenabaque', 'Reyes', 'Santa Rosa', 'Riberalta', 'Guayaramerín'
  ],
  'Oruro': [
    'Oruro', 'Huanuni', 'Challapata', 'Caracollo', 'Machacamarca',
    'Poopó', 'Pazña', 'Totora', 'Curahuara de Carangas', 'Turco',
    'Huachacalla', 'Escara', 'Cruz de Machacamarca', 'Yunguyo del Litoral',
    'Esmeralda', 'Sabaya', 'Coipasa', 'Chipaya', 'Andamarca',
    'Belén de Andamarca', 'Antequera', 'Belén de Urmiri', 'Totora',
    'Santiago de Huari', 'Huari', 'La Rivera', 'Todos Santos',
    'Carangas', 'Corque', 'Choquecota', 'Curahuara de Carangas',
    'San Pedro de Totora', 'Santiago de Huari', 'Huari', 'La Rivera',
    'Todos Santos', 'Carangas', 'Corque', 'Choquecota'
  ],
  'Cochabamba': [
    'Cochabamba', 'Quillacollo', 'Sacaba', 'Tiquipaya', 'Colcapirhua',
    'Vinto', 'Sipe Sipe', 'Punata', 'Arani', 'Cliza', 'Tarata',
    'Anzaldo', 'Arque', 'Bolívar', 'Capinota', 'Cercado', 'Chapare',
    'Chimoré', 'Colomi', 'Entre Ríos', 'Mizque', 'Morochata',
    'Omereque', 'Pasorapa', 'Pocona', 'Puerto Villarroel', 'San Benito',
    'Shinahota', 'Sipe Sipe', 'Tacopaya', 'Tapacarí', 'Tiquipaya',
    'Tolata', 'Totora', 'Vacas', 'Villa Rivero', 'Villa Tunari',
    'Chimore', 'Ivirgarzama', 'Bulo Bulo', 'Shinahota'
  ],
  'Santa Cruz': [
    'Santa Cruz de la Sierra', 'Warnes', 'Montero', 'La Guardia',
    'Cotoca', 'Porongo', 'El Torno', 'Samaipata', 'Camiri',
    'San José de Chiquitos', 'Roboré', 'Puerto Suárez', 'Yacuiba',
    'Ascensión de Guarayos', 'San Matías', 'San Ignacio de Velasco',
    'Concepción', 'San Javier', 'San Ramón de la Nueva Orán',
    'Buena Vista', 'San Carlos', 'Yapacaní', 'Mineros', 'Fernández Alonso',
    'San Pedro', 'Cuatro Cañadas', 'Pailón', 'San Julián', 'Roboré',
    'Carmen Rivero Tórrez', 'Charagua', 'Cabezas', 'Lagunillas',
    'Gutiérrez', 'Camiri', 'Boyuibe', 'Vallegrande', 'Trigal',
    'Moro Moro', 'Postrervalle', 'Pucará', 'San Juan del Potrero',
    'El Puente', 'Comarapa', 'Saipina', 'Florida', 'Mairana',
    'Samaipata', 'Quirusillas', 'Pampa Grande', 'Mairana', 'La Guardia'
  ],
  'Chuquisaca': [
    'Sucre', 'Camargo', 'Monteagudo', 'Padilla', 'Tarabuco',
    'Zudáñez', 'Presto', 'Mojocoya', 'Icla', 'Tarvita',
    'Azurduy', 'Tomina', 'Sopachuy', 'Villa Alcalá', 'El Villar',
    'Incahuasi', 'Macharetí', 'Huacareta', 'Villa Serrano',
    'San Lucas', 'Culpina', 'Las Carreras', 'Incahuasi', 'Macharetí',
    'Huacareta', 'Villa Serrano', 'San Lucas', 'Culpina', 'Las Carreras'
  ],
  'Potosí': [
    'Potosí', 'Uyuni', 'Tupiza', 'Villazón', 'Llallagua', 'Uncía',
    'Chayanta', 'Colquechaca', 'Ravelo', 'Pocoata', 'Ocurí',
    'San Pedro de Buena Vista', 'Toro Toro', 'Betanzos', 'Chaqui',
    'Tinguipaya', 'Yocalla', 'Urmiri', 'Porco', 'Arampampa',
    'Acasio', 'Llica', 'Tahua', 'Colcha K', 'San Agustín',
    'San Pablo de Lípez', 'Mojinete', 'San Antonio de Esmoruco',
    'Cotagaita', 'Vitichi', 'Sacaca', 'Caripuyo', 'Tinguipaya'
  ],
  'Tarija': [
    'Tarija', 'Bermejo', 'Yacuiba', 'Villamontes', 'Entre Ríos',
    'Padcaya', 'Uriondo', 'San Lorenzo', 'El Puente', 'Caraparí',
    'Yunchará', 'Iskayachi', 'San Lorenzo', 'Entre Ríos', 'Padcaya',
    'Uriondo', 'San Lorenzo', 'El Puente', 'Caraparí', 'Yunchará'
  ],
  'Beni': [
    'Trinidad', 'Riberalta', 'Guayaramerín', 'San Borja', 'Reyes',
    'Santa Rosa', 'Rurrenabaque', 'San Ignacio', 'Loreto', 'Baures',
    'Huacaraje', 'Magdalena', 'Puerto Siles', 'Santa Ana del Yacuma',
    'Exaltación', 'San Ramón', 'San Joaquín', 'Puerto Siles',
    'Magdalena', 'Baures', 'Huacaraje'
  ],
  'Pando': [
    'Cobija', 'Porvenir', 'Filadelfia', 'Bella Flor', 'Puerto Rico',
    'San Lorenzo', 'Santa Rosa del Abuná', 'Ingavi', 'Nueva Esperanza',
    'Villa Nueva', 'Santos Mercado', 'Bolpebra', 'Puerto Rico'
  ]
};

export const DEPARTMENTS = Object.keys(BOLIVIA_LOCATIONS);

export function getCities(department) {
  return BOLIVIA_LOCATIONS[department] || [];
}
