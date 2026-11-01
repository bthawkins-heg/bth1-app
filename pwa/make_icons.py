from PIL import Image, ImageDraw, ImageFont
import sys
font_path='/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
for size in (180,192,512):
    S=size*4
    im=Image.new('RGB',(S,S),(0,0,0))
    d=ImageDraw.Draw(im)
    pad=int(S*0.16); w=int(S*0.085)
    d.ellipse([pad,pad,S-pad,S-pad],outline=(58,40,12),width=w)
    d.arc([pad,pad,S-pad,S-pad],start=-90,end=200,fill=(255,159,10),width=w)
    f=ImageFont.truetype(font_path,int(S*0.36))
    t='B'; bb=d.textbbox((0,0),t,font=f)
    d.text(((S-(bb[2]-bb[0]))/2-bb[0],(S-(bb[3]-bb[1]))/2-bb[1]),t,font=f,fill=(255,255,255))
    im.resize((size,size),Image.LANCZOS).save(f'pwa/icon-{size}.png')
