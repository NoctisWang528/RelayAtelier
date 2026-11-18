"""Compose actual source/capture pairs for visual review; never used at runtime."""
from pathlib import Path
import os
from PIL import Image, ImageOps, ImageDraw
root=Path(__file__).resolve().parent.parent
evidence=root/os.environ.get('RELAY_EVIDENCE_DIR','evidence');out=evidence/'comparison';out.mkdir(parents=True,exist_ok=True)
for scene,ref in [('dial','westworld'),('loom','loom'),('factory','factory'),('rhythm','rhythm'),('slots','slots'),('roulette','roulette')]:
    source=Image.open(root/'research'/'user-reference'/f'{ref}.png').convert('RGB')
    actual=Image.open(evidence/'scenes'/f'{scene}-portrait-idle.png').convert('RGB')
    board=Image.new('RGB',(1448,918),'#e8e5de');d=ImageDraw.Draw(board)
    for i,(im,title) in enumerate([(source,'CrommaCode / supplied reference / idle'),(actual,'Relay Atelier / actual running capture / idle')]):
        fitted=ImageOps.contain(im,(720,880));x=i*728+(720-fitted.width)//2;y=32
        board.paste(fitted,(x,y));d.text((i*728+14,10),title,fill='#55524a')
    board.save(out/f'{scene}-reference-comparison.jpg',quality=92)
# An actual-capture overview, with no original screenshots mixed into the app artwork.
modes=['dial','factory','chips','rhythm','loom','dataflow','slots','roulette']
board=Image.new('RGB',(1440,1016),'#e8e5de');d=ImageDraw.Draw(board)
for i,scene in enumerate(modes):
    im=Image.open(evidence/'scenes'/f'{scene}-wide-demo.png').convert('RGB')
    im=ImageOps.contain(im,(480,314));x=i%3*480;y=i//3*338
    d.text((x+10,y+7),f'{scene.upper()} / DEMO',fill='#55524a');board.paste(im,(x,y+24))
board.save(evidence/'overview.jpg',quality=94)

def pair_crops(source, actual, crop, filename, titles=('Original / width-normalized reference','Current / running source capture')):
    source=Image.open(source).convert('RGB')
    source=source.resize((1440,round(source.height*1440/source.width)),Image.Resampling.LANCZOS)
    actual=Image.open(actual).convert('RGB')
    board=Image.new('RGB',(1440,800),'#e8e5de');d=ImageDraw.Draw(board)
    for i,im in enumerate((source,actual)):
        part=ImageOps.contain(im.crop(crop),(700,750))
        board.paste(part,(i*720+(720-part.width)//2,40));d.text((i*720+12,12),titles[i],fill='#55524a')
    board.save(out/filename,quality=94)

pair_crops(root/'research/user-reference/westworld.png',evidence/'scenes/dial-portrait-idle.png',(905,875,1405,1360),'dial-vessel-detail.jpg')
pair_crops(root/'research/user-reference/westworld.png',evidence/'scenes/dial-portrait-idle.png',(0,70,1030,1380),'dial-calibration.jpg')
pair_crops(root/'research/user-reference/factory.png',evidence/'scenes/factory-portrait-idle.png',(0,150,1000,1250),'factory-left-detail.jpg')

source=root/'research/rea/rhythm-active-video.png';actual=evidence/'rhythm-motion/reference-aspect-active.png'
if source.exists() and actual.exists():
    board=Image.new('RGB',(1448,670),'#e8e5de');d=ImageDraw.Draw(board)
    for i,(path,title) in enumerate([(source,'Official video / active / original event stream'),(actual,'Running source / active Demo / different event stream')]):
        im=ImageOps.contain(Image.open(path).convert('RGB'),(720,630));board.paste(im,(i*728,32));d.text((i*728+8,10),title,fill='#55524a')
    board.save(out/'rhythm-active-comparison.jpg',quality=94)

board=Image.new('RGB',(1440,2028),'#e8e5de');d=ImageDraw.Draw(board)
for row,scene in enumerate(['dial','factory','chips','rhythm','loom','dataflow']):
    for col in range(3):
        im=ImageOps.contain(Image.open(evidence/'scenes'/f'{scene}-motion-{col+1}.png').convert('RGB'),(480,314))
        x=col*480;y=row*338;d.text((x+8,y+7),f'{scene.upper()} / DEMO / frame {col+1}',fill='#55524a');board.paste(im,(x,y+24))
board.save(evidence/'motion-sequence.jpg',quality=93)
