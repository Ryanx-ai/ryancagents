"""Ryan HQ original 2.5D office. Run with Blender --background --python this.py.

No downloaded models/textures. The 1100x800 projection is the application's
existing coordinate contract; characters and live information are never baked.
Optional args after --: --preview --night-only --day-only --output DIR
"""
import bpy, math, random, sys, os, json
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = Path(ARGS[ARGS.index('--output') + 1]) if '--output' in ARGS else ROOT / '.local/office-renders'
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW = '--preview' in ARGS
ANGLE = math.radians(18)
S, C = math.sin(ANGLE), math.cos(ANGLE)
random.seed(27)

def rgba(h):
    h = h.lstrip('#')
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)

def material(name, color, rough=.65, metal=0, texture=None, emission=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    n = m.node_tree.nodes; l = m.node_tree.links; bs = n.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = rgba(color)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if emission:
        bs.inputs['Emission Color'].default_value = rgba(color)
        bs.inputs['Emission Strength'].default_value = emission
    if texture:
        tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=5 if texture=='wood' else 85
        tex.inputs['Detail'].default_value=3
        coords=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY'
        mapping.inputs[1].default_value=(1,24,6) if texture=='wood' else (1,1,1)
        l.new(coords.outputs['Generated'],mapping.inputs[0]);l.new(mapping.outputs[0],tex.inputs['Vector'])
        ramp=n.new('ShaderNodeValToRGB');base=rgba(color)
        ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[0].color=tuple(v*.65 for v in base[:3])+(1,)
        ramp.color_ramp.elements[1].position=.85;ramp.color_ramp.elements[1].color=base
        l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],bs.inputs['Base Color'])
        bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.025 if texture=='wood' else .012
        l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],bs.inputs['Normal'])
    return m

def point(px,py,depth=0):
    return ((px-550)/100,depth,((400-py)/100-depth*S)/C)

def box(name, loc, dim, mat, bevel=.018):
    # Direct mesh creation avoids an expensive dependency-graph update for
    # every plank/key/frame while constructing this static scene.
    dx,dy,dz=(v/2 for v in dim)
    verts=[(x,y,z) for x in (-dx,dx) for y in (-dy,dy) for z in (-dz,dz)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)]);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=loc
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=bevel;mod.segments=3
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def rect(name,x,y,w,h,depth,thick,mat,bevel=.018):
    return box(name,point(x+w/2,y+h/2,depth),(w/100,thick,h/100/C),mat,bevel)

def cylinder(name, loc, radius, depth, mat, vertices=32, top_radius=None):
    top_radius=radius if top_radius is None else top_radius
    verts=[(math.cos(i*math.tau/vertices)*r,math.sin(i*math.tau/vertices)*r,z) for z,r in [(-depth/2,radius),(depth/2,top_radius)] for i in range(vertices)]
    faces=[tuple(reversed(range(vertices))),tuple(range(vertices,vertices*2))]
    faces += [(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=loc;o.data.materials.append(mat)
    be=o.modifiers.new('Rim bevel','BEVEL');be.width=.012;be.segments=2
    for p in o.data.polygons:p.use_smooth=True
    return o

def rod(name,a,b,radius,mat):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,radius,(b-a).length,mat,12)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def leaf(name,loc,size,rotation,mat):
    segments,rings=12,8
    verts=[(math.sin(j*math.pi/rings)*math.cos(i*math.tau/segments),math.sin(j*math.pi/rings)*math.sin(i*math.tau/segments),math.cos(j*math.pi/rings)) for j in range(rings+1) for i in range(segments)]
    faces=[(j*segments+i,(j+1)*segments+i,(j+1)*segments+(i+1)%segments,j*segments+(i+1)%segments) for j in range(rings) for i in range(segments)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=loc;o.scale=size;o.rotation_euler=rotation;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True

def area(name,loc,target,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o

def build(night):
    print('RYAN_BUILD_START '+('night' if night else 'day'),flush=True)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):bpy.data.materials.remove(m)
    random.seed(27)
    window_lights=random.Random(2701)
    oak=material('Warm oak / fine grain','#ae8b5e',texture='wood')
    edge=material('Dark stained oak','#62503b',texture='wood')
    plaster=material('Sage mineral plaster','#787d72',texture='plaster')
    wallDark=material('Inset slate plaster','#4b5d5d',texture='plaster')
    metal=material('Brushed charcoal metal','#333c40',rough=.36,metal=.55)
    brass=material('Aged brass','#b69b67',rough=.38,metal=.6)
    cream=material('Ivory ceramic','#e1d5b7',rough=.32)
    paper=material('Warm white paper','#d9d6c7',rough=.92)
    green=material('Waxed jade foliage','#527f62',rough=.48)
    green2=material('Leaf sage highlights','#7d9a6a',rough=.52)
    trunk=material('Plant stems','#555e3b')
    fabric=material('Sage woven upholstery','#6d8273',texture='fabric')
    cushion=material('Golden linen cushions','#c8ab75',texture='fabric')
    screen=material('Inactive slate screen','#1d343e',rough=.3,emission=.15)
    screenLine=material('Muted screen lines','#617779',emission=.18)
    lamp=material('Warm lamp diffuser','#ffe2a8',emission=2 if night else .7)
    dark=material('Deep exterior','#182c34')
    # A continuous slate backdrop prevents any transparent holes during scrolling.
    rect('Outer blue backdrop',-30,-30,1160,860,3.1,.1,dark,0)
    rect('Upstairs plaster',33,43,1034,286,2.6,.16,plaster)
    rect('Lower plaster',33,351,1034,350,2.6,.16,plaster)
    # Quiet panel seams and plinths, not a repetitive high-contrast brick grid.
    for x in [235,440,595,885]:
        rect('Fine upstairs plaster joint',x,57,1,226,2.50,.005,wallDark,0)
    for x in [83,303,523,743,963]:
        rect('Fine lower plaster joint',x,358,1,220,2.50,.005,wallDark,0)
    for x in [46,1041]:
        rect('Timber post',x-8,43,22,757,.9,.32,edge,.035)
        rect('Post brass inlay',x-3,49,2,751,.72,.015,brass,.004)
    rect('Ceiling timber',28,39,1044,18,.5,.36,edge,.025)
    rect('Ceiling warm edge',31,55,1038,3,.29,.025,oak,.004)

    # Floors are actual horizontal planes. Their projection puts actor feet at
    # y300/600 while retaining shallow visible depth behind and in front.
    def floor(name,base_y,width,xcenter,front,back):
        z=point(550,base_y,0)[2];planks=[]
        rows=math.ceil((back-front)/.28)
        for j in range(rows):
            dep=front+j*.28+.14
            left,right=xcenter-width/2,xcenter+width/2
            for i in range(math.ceil(width/1.12)+1):
                start=left-(j%3)*.37+i*1.12
                px=max(left,start);end=min(right,start+1.118)
                length=end-px
                if length<=0:continue
                planks.append(box(name+' plank',(px+length/2,dep,z-.055),(length,.277,.11),oak,.003))
        box(name+' front fascia',(xcenter,front-.025,z-.11),(width,.11,.23),edge,.015)
        box(name+' lip',(xcenter,front-.085,z+.005),(width+.06,.035,.035),brass,.006)
    floor('Upper platform',300,9.69,-.39,-.87,1.55)
    floor('Ground floor',600,10.4,0,-6.5,1.5)

    # Recessed window frames with independent city and distant tree planes.
    sky=material('Night sky' if night else 'Morning sky','#5b759b' if night else '#9ebbc5',emission=.4)
    sky.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.85
    for idx,(x,y,w,h) in enumerate([(251,94,165,132),(606,94,264,132)]+[(x,395,160,120) for x in [119,339,559,779]]):
        rect('Window recess',x-9,y-9,w+18,h+18,2.39,.11,edge)
        rect('Window sky',x,y,w,h,2.31,.025,sky,0)
        # Far skyline: low-detail silhouettes keep the work floor legible.
        for k in range(int(w/25)+1):
            bw=min(21,w-k*25);bh=random.randint(22,52)
            if bw<=0:continue
            city=material('City tone %s %s'%(idx,k),'#34465e' if night else '#7d969e')
            rect('Distant city block',x+k*25,y+h-bh,bw,bh,2.25,.025,city,.002)
            if night:
                for row in range(2):
                    for col in range(2):
                        if window_lights.random()>.35:rect('Distant lit window',x+k*25+4+col*8,y+h-bh+7+row*11,3,4,2.22,.01,lamp,.001)
        for k in range(5):
            tx=x+12+k*(w-24)/4;ty=y+h-7
            leaf('Soft distant tree',point(tx,ty,2.15),(.13,.035,.17),(0,0,0),green)
        # Window crossbars and layered sill show actual thickness.
        for xx in [x-3,x+w/2-2,x+w-3]:rect('Window mullion',xx,y-3,6,h+6,2.0,.14,metal,.01)
        for yy in [y-3,y+h/2-2,y+h-3]:rect('Window horizontal rail',x-3,yy,w+6,6,2.0,.14,metal,.01)
        rect('Deep window sill',x-12,y+h+2,w+24,7,1.90,.45,oak,.025)
        if idx==1:
            orb=material('Moon' if night else 'Sun','#eee6c9' if night else '#ffe6b0',emission=1 if night else .7)
            leaf('Moon / sun',point(x+w-35,y+26,2.21),(.135,.025,.135),(0,0,0),orb)

    # Blackboard and clock are HTML/SVG layers; only recesses are rendered.
    rect('Blackboard wall recess',72,82,158,182,2.2,.12,edge,.045)
    rect('Clock wall mounting plate',433,102,160,103,2.20,.10,wallDark,.045)

    def plant(px,py,scale=1,depth=.2):
        root=Vector(point(px,py,depth));s=scale
        pot=cylinder('Glazed planter',root+Vector((0,0,.12*s)),.16*s,.24*s,cream)
        pot.scale=(1,1,1);cylinder('Planter rim',root+Vector((0,0,.24*s)),.175*s,.045*s,oak)
        for i in range(7):
            ang=i*2.4;tip=root+Vector((math.cos(ang)*.22*s,math.sin(ang)*.13*s,(.42+i*.055)*s))
            rod('Plant stem',root+Vector((0,0,.22*s)),tip,.012*s,trunk)
            leaf('Broad wax leaf',tip,(.17*s,.065*s,.095*s),(0,math.sin(ang)*.7,ang),green if i%2 else green2)
    plant(453,279,.85,.68);plant(912,279,.85,.68)
    plant(95,579,.8,.68);plant(947,579,.7,.68)
    plant(1030,751,1.1,-4.89);plant(65,759,.9,-5.15)

    def desk(px,py,kind='worker'):
        # The same screen corners as the live SVG activity overlay.
        rect(kind+' chair back',px-28,py-76,51,54,.45,.2,fabric,.09)
        rect(kind+' chair cushion',px-30,py-25,55,10,.18,.55,fabric,.045)
        rod('Chair pedestal',point(px-3,py-18,.32),point(px-3,py-2,.32),.027,metal)
        for dx in [-20,20]:rod('Chair foot',point(px-3,py-3,.32),point(px+dx,py-1,.1),.02,metal)
        rect(kind+' oak tabletop',px-79,py-53,161,9,-.25,.70,oak,.028)
        rect('Tabletop underframe',px-73,py-44,149,5,-.22,.46,edge,.008)
        for xx in [px-69,px+70]:rect('Steel desk leg',xx-3,py-39,6,39,.1,.12,metal,.013)
        rect('Desk brace',px-66,py-17,135,3,.05,.05,metal,.008)
        width=73 if kind=='designer' else 63
        rect('Monitor casing',px-5,py-109,width+2,46,-.01,.11,metal,.035)
        rect('Monitor glass',px+1,py-103,width-10,32,-.075,.008,screen,.005)
        for xx,yy,ww in [(8,-94,21),(8,-86,36),(8,-78,27)]:rect('Subdued screen line',px+xx,py+yy,ww,2,-.083,.002,screenLine,.001)
        rect('Monitor pedestal',px+26,py-65,5,11,.01,.12,metal,.006)
        rect('Monitor base',px+13,py-56,31,3,-.03,.28,metal,.009)
        rect('Keyboard',px-13,py-59,32,3,-.48,.18,metal,.01)
        for row in range(2):
            for col in range(9):rect('Keyboard key',px-11+col*3.2,py-59+row,2,1,-.59,.014,screenLine,.001)
        # Cup and books; deliberately tactile but below sprite visual weight.
        cup=cylinder('Ceramic mug',point(px+66,py-60,-.20),.055,.12,cream)
        rod('Mug handle top',point(px+71,py-64,-.20),point(px+75,py-64,-.20),.012,cream)
        rod('Mug handle side',point(px+75,py-64,-.20),point(px+75,py-58,-.20),.012,cream)
        for i in range(3):rect('Desk paper stack',px-61+i,py-60-i*2,27-i*2,2,-.32,.22,paper,.002)
        a=point(px-62,py-64,-.05);b=point(px-62,py-100,-.05);d=point(px-46,py-114,-.05)
        rod('Task lamp vertical',a,b,.018,brass);rod('Task lamp arm',b,d,.018,brass)
        shade=cylinder('Task lamp shade',point(px-43,py-111,-.08),.09,.08,brass);shade.rotation_euler[1]=-.35
        area('Task lamp pool',point(px-43,py-108,-.15),point(px-36,py-53,-.2),4 if night else 1.5,(1,.76,.42),.28)
        if kind=='manager':
            rect('Manager pedestal drawers',px-57,py-38,34,36,.01,.43,edge,.025)
            for yy in [py-25,py-11]:rect('Drawer brass pull',px-45,yy,11,2,-.22,.03,brass,.005)
        if kind=='designer':
            rect('Designer tablet',px-34,py-65,28,4,-.58,.19,metal,.012)
            rod('Tablet pen',point(px-15,py-66,-.6),point(px-7,py-74,-.6),.008,brass)
    desk(319,297,'manager');desk(759,297,'designer')
    for x in [209,429,649,869]:desk(x,598)

    def pendant(px,py):
        rod('Pendant cord',point(px,py,.65),point(px,py+24,.65),.012,metal)
        cylinder('Brushed dome pendant',point(px,py+27,.65),.27,.12,brass,48,top_radius=.115)
        cylinder('Pendant warm underside',point(px,py+34,.65),.25,.012,lamp)
        area('Pendant light',point(px,py+38,.65),point(px,py+190,-.2),55 if night else 25,(1,.78,.52),1.1)
    for x in [319,759]:pendant(x,56)
    for x in [209,429,649,869]:pendant(x,354)

    # Side staircase keeps its established location, with proper step depth.
    for i in range(12):
        x,y=970+i*7,592-i*24
        rect('Stair oak tread',x,y,34,5,-.2,.56,oak,.015)
        rod('Stair upright',point(x+4,y,-.50),point(x+4,y-30,-.50),.014,metal)
    rod('Stair handrail',point(974,562,-.5),point(1054,286,-.5),.025,brass)
    rod('Stair steel stringer',point(983,598,.04),point(1060,324,.04),.055,metal)

    # Lounge in the lower foreground, away from actors and dock.
    rect('Sofa lower frame',99,722,156,18,-4.9,.65,edge,.035)
    rect('Sofa upholstered back',104,678,146,39,-4.3,.25,fabric,.08)
    for x in [108,155,202]:rect('Sofa seat cushion',x,708,45,14,-4.65,.52,fabric,.055)
    for x in [99,242]:rect('Sofa arm',x,694,15,43,-4.62,.68,fabric,.06)
    rect('Sofa loose cushion',119,691,25,24,-4.52,.15,cushion,.055)
    for x in [109,241]:rect('Sofa tapered foot',x,740,5,9,-4.8,.05,metal,.01)
    # Coffee station with tile splashback and tiny practical details.
    rect('Coffee cabinet',889,683,78,66,-4.85,.58,edge,.03)
    rect('Coffee countertop',884,681,88,7,-4.95,.75,oak,.025)
    for yy in [710,732]:
        rect('Cabinet drawer joint',894,yy,68,1,-5.15,.01,metal,.002)
        rect('Cabinet pull',922,yy-8,13,2,-5.17,.035,brass,.004)
    rect('Coffee machine',907,649,35,33,-4.75,.28,metal,.04)
    rect('Coffee machine panel',912,654,25,11,-4.90,.01,screen,.006)
    cylinder('Coffee cup',point(927,676,-5),.06,.09,cream)
    # Small studio palette board: no text or agent identity baked in.
    rect('Palette frame',926,110,49,91,2.20,.11,oak,.025)
    rect('Palette backing',931,115,39,81,2.13,.02,paper,.008)
    for i,color in enumerate(['#c6a7df','#8bc6aa','#efb66d','#a6b5ff']):
        rect('Studio color study',936+(i%2)*18,127+(i//2)*30,12,20,2.09,.02,material('Paint swatch '+str(i),color),.003)

    world=bpy.data.worlds.new('Night atmosphere' if night else 'Day atmosphere');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.21,.32,1) if night else (.55,.67,.74,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.3 if night else .5;bpy.context.scene.world=world
    area('Broad frontal fill',(0,-10,7),(0,1,0),650 if night else 1600,(.55,.70,1) if night else (1,.93,.79),10)
    area('Warm side key',(-5,-3,7),(0,0,0),300 if night else 1400,(1,.73,.43) if night else (1,.87,.65),6)
    area('Cool window bounce',(4,1.2,4),(0,-1,0),180 if night else 500,(.38,.57,1) if night else (.66,.84,1),5)
    scene=bpy.context.scene
    camera_data=bpy.data.cameras.new('Locked 1100 x 800 orthographic camera');camera=bpy.data.objects.new('Office camera',camera_data);bpy.context.collection.objects.link(camera)
    camera.location=(0,-30*C,30*S);camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type='ORTHO';camera_data.ortho_scale=11;camera_data.lens=50;scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=12 if PREVIEW else 24;scene.cycles.use_denoising=True
    scene.cycles.device='CPU';scene.cycles.use_adaptive_sampling=True
    scene.cycles.adaptive_threshold=.06;scene.cycles.adaptive_min_samples=8
    scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1100 if PREVIEW else 2200;scene.render.resolution_y=800 if PREVIEW else 1600;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.65 if night else .1
    scene.render.film_transparent=False
    scene['projection_contract']='1100x800; actor feet y300/y600; sprite assets unchanged'
    scene['provenance']='Original procedural geometry and shaders created for Ryan HQ; no third-party game assets.'
    label='night' if night else 'day';scene.render.filepath=str(OUT/('ryan-hq-'+label+'.png'))
    print('RYAN_BUILD_READY '+label,flush=True)
    if not PREVIEW:
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('ryan-hq-'+label+'.blend')),compress=True)
    bpy.ops.render.render(write_still=True)
    print('RYAN_RENDER_COMPLETE '+label,flush=True)

for night in ([True] if '--night-only' in ARGS else [False] if '--day-only' in ARGS else [False,True]):build(night)
