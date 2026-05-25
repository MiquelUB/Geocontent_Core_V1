
import fs from 'fs';
import path from 'path';

const baseDir = 'd:/MK/MP/Geocontent_Core/public/poi-icons';
const biomes = ['Blossom', 'City', 'Interior', 'Mar', 'Montanya'];
const mapping = {};

biomes.forEach(biome => {
    const biomePath = path.join(baseDir, biome);
    if (fs.existsSync(biomePath)) {
        const files = fs.readdirSync(biomePath);
        mapping[biome] = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    }
});

fs.writeFileSync('d:/MK/MP/Geocontent_Core/public/poi-icons/icons-mapping.json', JSON.stringify(mapping, null, 2));
console.log('Icons mapping generated.');
