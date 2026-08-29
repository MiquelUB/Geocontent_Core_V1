const fs = require('fs');
const path = 'components/admin/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/{editingLegend\s*&&\s*\([\s\S]*?<Label[^>]*>Consola de Vídeo HLS \(Extra\)<\/Label>\s*<VideoUploader poiId={editingLegend\.id} theme={adminTheme} \/>\s*<\/div>\s*\)}/,
`{editingPoi?.id && (
                      <div className="pt-6 border-t border-stone-100">
                        <Label className="mb-4 block text-stone-800 font-bold">Consola de Vídeo HLS (Extra)</Label>
                        <VideoUploader 
                          poiId={editingPoi.id} 
                          theme={adminTheme} 
                          existingVideos={editingPoi.videoUrls || editingPoi.video_urls || (editingPoi.videoUrl ? [editingPoi.videoUrl] : (editingPoi.video_url ? [editingPoi.video_url] : []))} 
                        />
                      </div>
                    )}`);
                    
fs.writeFileSync(path, content);
console.log("Fixed!");
