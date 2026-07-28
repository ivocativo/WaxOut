# gen_hero_parts.ps1 — genera i PEZZI del pupazzo dell'eroe (esploratore del condotto)
# come PNG separati + due anteprime (pezzi singoli con perni, e personaggio montato fermo).
# Pixel-art nativa, niente antialias, contorno scuro 1px per pezzo. Ogni pezzo e' disegnato
# in coordinate "master" (lo stesso spazio della posa di riposo) poi ritagliato al contenuto;
# il perno (giuntura) e' registrato in pixel del pezzo ritagliato.
#
# Uso:  powershell -NoProfile -File tools\gen_hero_parts.ps1 [-Out <cartella_anteprime>]
param([string]$Out = "")

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets\sprites\hero"))
New-Item -ItemType Directory -Force -Path $root | Out-Null
if ($Out -eq "") { $Out = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets")) }

$MW = 44; $MH = 64                       # dimensioni canvas "master"
$OUTLINE = [System.Drawing.Color]::FromArgb(255, 0x14, 0x16, 0x1f)

function C([string]$hex) {
  $r=[Convert]::ToInt32($hex.Substring(0,2),16); $g=[Convert]::ToInt32($hex.Substring(2,2),16); $b=[Convert]::ToInt32($hex.Substring(4,2),16)
  return [System.Drawing.Color]::FromArgb(255,$r,$g,$b)
}
function New-Master {
  $bmp = New-Object System.Drawing.Bitmap($MW,$MH,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::None
  $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.Clear([System.Drawing.Color]::Transparent)
  return [pscustomobject]@{ bmp=$bmp; g=$g }
}
function Ell($cv,$col,$x,$y,$w,$h){ $b=New-Object System.Drawing.SolidBrush($col); $cv.g.FillEllipse($b,$x,$y,$w,$h); $b.Dispose() }
function Rct($cv,$col,$x,$y,$w,$h){ $b=New-Object System.Drawing.SolidBrush($col); $cv.g.FillRectangle($b,$x,$y,$w,$h); $b.Dispose() }
function Px($cv,$col,$x,$y){ if($x -ge 0 -and $y -ge 0 -and $x -lt $MW -and $y -lt $MH){ $cv.bmp.SetPixel([int]$x,[int]$y,$col) } }
function Line($cv,$col,$x0,$y0,$x1,$y1,$wd){
  $steps=[Math]::Max([Math]::Abs($x1-$x0),[Math]::Abs($y1-$y0)); if($steps -eq 0){$steps=1}
  for($i=0;$i -le $steps;$i++){ $x=[int][Math]::Round($x0+($x1-$x0)*$i/$steps); $y=[int][Math]::Round($y0+($y1-$y0)*$i/$steps); Rct $cv $col $x $y $wd $wd }
}
function Add-Outline($cv){
  $w=$cv.bmp.Width; $h=$cv.bmp.Height; $src=New-Object System.Drawing.Bitmap($cv.bmp)
  for($y=0;$y -lt $h;$y++){ for($x=0;$x -lt $w;$x++){
    if($src.GetPixel($x,$y).A -ne 0){continue}; $near=$false
    for($dy=-1;$dy -le 1 -and -not $near;$dy++){ for($dx=-1;$dx -le 1;$dx++){
      $nx=$x+$dx;$ny=$y+$dy; if($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h){continue}
      if($src.GetPixel($nx,$ny).A -ne 0){$near=$true;break} } }
    if($near){$cv.bmp.SetPixel($x,$y,$OUTLINE)} } }
  $src.Dispose()
}

# ---------- posatore (cinematica diretta per l'anteprima in posa) ----------
function RotV($x,$y,$angDeg){ $r=[double]$angDeg*[Math]::PI/180.0; return [pscustomobject]@{ x=([double]$x*[Math]::Cos($r)-[double]$y*[Math]::Sin($r)); y=([double]$x*[Math]::Sin($r)+[double]$y*[Math]::Cos($r)) } }
function DrawFK($g,$part,$wx,$wy,$angDeg){
  $g.ResetTransform()
  $g.TranslateTransform([single]$wx,[single]$wy)
  $g.RotateTransform([single]$angDeg)
  $g.TranslateTransform([single](-[double]$part.pivX),[single](-[double]$part.pivY))
  $g.DrawImage($part.bmp,0,0)
  $g.ResetTransform()
}
function PartOf($key){ foreach($p in $parts){ if($p.key -eq $key){ return $p } }; return $null }

# ---------- palette ----------
$SKIN=C "f2c9a0"; $SKIN_D=C "d69f78"; $SKIN_L=C "ffe0bf"
$SUIT=C "3f7fd6"; $SUIT_D=C "2c5ea8"; $SUIT_L=C "5f9ae8"; $SUIT_XD=C "21467e"
$HELM=C "e08a2a"; $HELM_D=C "a85f12"; $HELM_L=C "ffb84d"
$LAMP=C "fff6c0"; $LAMP_C=C "ffffff"
$GOG=C "9fd8e6"; $GOG_D=C "2a2f3d"; $GOG_L=C "e8fbff"
$TANK=C "dfe9ef"; $TANK_D=C "9fb3c2"; $TANK_B=C "6fc3d6"
$METAL=C "c0c6d0"; $METAL_D=C "8a909c"
$BOOT=C "222a3a"; $BOOT_L=C "3a4560"
$GLOVE=C "e6ebf2"; $GLOVE_D=C "b9c1cf"
$BELT=C "6a4a2a"; $BELT_L=C "8a6a45"

# ---------- registro pezzi ----------
$parts = New-Object System.Collections.ArrayList
function Add-Part($key,$cv,$pivX,$pivY){
  Add-Outline $cv; $cv.g.Dispose()
  [void]$parts.Add([pscustomobject]@{ key=$key; bmp=$cv.bmp; pivX=$pivX; pivY=$pivY })
}

# NOTE: proporzioni eroiche (testa ~30%, gambe lunghe) e ARTI A 2 SEGMENTI
# (gomito/ginocchio). Ogni segmento e' disegnato nella sua posa di RIPOSO (verticale)
# col perno sulla giuntura ALTA (spalla/gomito/anca/ginocchio). Giunture master:
#   collo (22,19) · spalle (18,23)/(26,23) · gomiti y33 · anche (19,37)/(25,37)
#   ginocchia y48 · piedi y60 · bacino (22,37)

# ============ TANK (zaino-serbatoio, dietro a tutto) ============
$cv=New-Master
Ell $cv $TANK 6 20 12 6
Rct $cv $TANK 7 23 10 13
Ell $cv $TANK 6 33 12 6
Rct $cv $TANK_D 13 23 4 16
Rct $cv $TANK_B 7 26 10 2
Rct $cv $TANK_B 7 32 10 2
Ell $cv $LAMP_C 8 21 3 2
Rct $cv $METAL 9 18 3 3
Add-Part "hero_tank" $cv 16 24

# ============ BRACCIO DIETRO — omero (spalla->gomito) ============
$cv=New-Master
Ell $cv $SUIT_D 16 22 5 4
Rct $cv $SUIT_D 16 23 5 11
Rct $cv $SUIT_XD 19 24 2 10
Add-Part "hero_backarm_up" $cv 18 24

# ============ BRACCIO DIETRO — avambraccio (gomito->mano) ============
$cv=New-Master
Rct $cv $SUIT_D 16 31 5 11          # +2 in alto = sormonta il gomito
Rct $cv $SUIT_XD 19 31 2 10
Ell $cv $GLOVE_D 16 41 5 5
Add-Part "hero_backarm_lo" $cv 18 33

# ============ GAMBA DIETRO — coscia (anca->ginocchio) ============
$cv=New-Master
Rct $cv $SUIT_D 15 37 6 12
Rct $cv $SUIT_XD 19 38 2 10
Add-Part "hero_backleg_up" $cv 18 38

# ============ GAMBA DIETRO — stinco+stivale (ginocchio->piede) ============
$cv=New-Master
Rct $cv $SUIT_D 16 46 5 11          # +2 in alto = sormonta il ginocchio
Rct $cv $SUIT_XD 19 46 2 10
Rct $cv $BOOT 13 56 8 4
Ell $cv $BOOT 18 57 4 3
Add-Part "hero_backleg_lo" $cv 18 48

# ============ TORSO (radice = bacino) ============
$cv=New-Master
Ell $cv $SUIT 14 18 16 9
Rct $cv $SUIT 15 22 14 15
Rct $cv $SUIT_L 15 22 3 13
Rct $cv $SUIT_D 26 22 3 15
Rct $cv $SUIT_L 18 20 8 2          # colletto
Rct $cv $SUIT_XD 21 23 1 11        # zip
Line $cv $HELM_D 17 23 26 35 1     # tracolla attrezzatura
Line $cv $HELM   17 24 26 36 1
Rct $cv $BELT 15 34 14 3
Rct $cv $BELT_L 15 34 14 1
Rct $cv $HELM_L 21 34 3 3          # fibbia
Add-Part "hero_torso" $cv 22 37

# ============ HEAD (3/4 verso DESTRA: naso e lampada davanti, guarda dove va) ============
$cv=New-Master
Ell $cv $SKIN 15 10 15 9            # faccia
Rct $cv $SKIN_D 15 12 3 6           # lato LONTANO (sinistra) in ombra
Rct $cv $SKIN 29 14 2 3             # naso che sporge a destra
Px  $cv $SKIN_D 30 16
# occhi 3/4: vicino (destra) grande, lontano (sinistra) accennato
Ell $cv $OUTLINE 25 13 2 3; Px $cv $LAMP_C 25 13
Px  $cv $OUTLINE 21 14; Px $cv $LAMP_C 21 13
# sopracciglio accennato + sorriso spostato a destra
Px  $cv $SKIN_D 24 12; Px $cv $SKIN_D 25 12
Px  $cv $OUTLINE 24 17; Px $cv $OUTLINE 25 18; Px $cv $OUTLINE 26 18; Px $cv $OUTLINE 27 17
# casco cupola
Ell $cv $HELM 13 1 18 11
Ell $cv $HELM_L 16 2 8 4
Rct $cv $HELM 12 9 20 3             # brim
Rct $cv $HELM 30 9 4 2             # visiera anteriore (destra)
Rct $cv $HELM_D 12 12 22 1
# occhialoni su (prospettiva 3/4)
Ell $cv $GOG_D 16 4 6 4; Ell $cv $GOG 17 5 4 2; Px $cv $GOG_L 18 5
Ell $cv $GOG_D 23 4 5 4; Ell $cv $GOG 24 5 3 2; Px $cv $GOG_L 25 5
# lampada frontale sul DAVANTI (destra), punta a destra + accenno di fascio
Ell $cv $OUTLINE 29 6 7 7
Ell $cv $METAL 30 7 5 5
Ell $cv $LAMP 32 8 3 3
Px  $cv $LAMP_C 33 9
Px  $cv $LAMP 36 9; Px $cv $LAMP 37 10
Add-Part "hero_head" $cv 22 19

# ============ GAMBA DAVANTI — coscia ============
$cv=New-Master
Rct $cv $SUIT 23 37 6 12
Rct $cv $SUIT_L 23 37 2 11
Add-Part "hero_frontleg_up" $cv 26 38

# ============ GAMBA DAVANTI — stinco+stivale ============
$cv=New-Master
Rct $cv $SUIT 24 46 5 11            # +2 in alto = sormonta il ginocchio
Rct $cv $SUIT_L 24 46 2 10
Rct $cv $BOOT 23 56 8 4
Ell $cv $BOOT 29 57 4 3
Rct $cv $BOOT_L 24 56 6 1
Add-Part "hero_frontleg_lo" $cv 26 48

# ============ BRACCIO DAVANTI — omero ============
$cv=New-Master
Ell $cv $SUIT 24 22 5 4
Rct $cv $SUIT 24 23 5 11
Rct $cv $SUIT_L 24 23 2 11
Add-Part "hero_frontarm_up" $cv 26 24

# ============ BRACCIO DAVANTI — avambraccio + SPRUZZATORE ============
$cv=New-Master
Rct $cv $SUIT 24 31 5 10            # +2 in alto = sormonta il gomito
Rct $cv $SUIT_L 24 31 2 10
Ell $cv $GLOVE 25 39 6 5            # guanto/mano
Rct $cv $METAL 29 40 6 3            # spruzzatore (nozzle in avanti dalla mano)
Rct $cv $METAL_D 29 43 4 2
Rct $cv $METAL 34 40 4 2
Rct $cv $METAL_D 34 41 4 1
Rct $cv $GOG 38 40 2 2              # ugello azzurro
Px $cv $LAMP_C 30 40
Add-Part "hero_frontarm_lo" $cv 26 33

# ---------- salva i PNG ritagliati + registra i perni ----------
$order = @("hero_tank","hero_backarm_up","hero_backarm_lo","hero_backleg_up","hero_backleg_lo","hero_torso","hero_frontleg_up","hero_frontleg_lo","hero_head","hero_frontarm_up","hero_frontarm_lo")
$pivots = @{}
foreach($p in $parts){
  # ritaglia al contenuto
  $minx=$MW;$miny=$MH;$maxx=-1;$maxy=-1
  for($y=0;$y -lt $MH;$y++){ for($x=0;$x -lt $MW;$x++){ if($p.bmp.GetPixel($x,$y).A -ne 0){ if($x -lt $minx){$minx=$x}; if($x -gt $maxx){$maxx=$x}; if($y -lt $miny){$miny=$y}; if($y -gt $maxy){$maxy=$y} } } }
  $cw=$maxx-$minx+1; $ch=$maxy-$miny+1
  $crop=New-Object System.Drawing.Bitmap($cw,$ch,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $cg=[System.Drawing.Graphics]::FromImage($crop); $cg.DrawImage($p.bmp,(New-Object System.Drawing.Rectangle(0,0,$cw,$ch)),$minx,$miny,$cw,$ch,[System.Drawing.GraphicsUnit]::Pixel); $cg.Dispose()
  $crop.Save((Join-Path $root ($p.key+".png")),[System.Drawing.Imaging.ImageFormat]::Png)
  $p | Add-Member -NotePropertyName ox -NotePropertyValue $minx -Force
  $p | Add-Member -NotePropertyName oy -NotePropertyValue $miny -Force
  $p | Add-Member -NotePropertyName cw -NotePropertyValue $cw -Force
  $p | Add-Member -NotePropertyName ch -NotePropertyValue $ch -Force
  [int]$pvx = [int]$p.pivX - [int]$minx
  [int]$pvy = [int]$p.pivY - [int]$miny
  $pivots[[string]$p.key] = @($pvx, $pvy)
}

# ---------- POSA di riposo (cinematica diretta) — gomiti/ginocchia piegati, gambe sfalsate ----------
# angoli in gradi (orario +). Per un arto rivolto in giu': + = verso sinistra/dietro, - = verso destra/avanti.
$P = @{ head=-2; bau=9; bal=10; fau=-12; fal=26; blu=7; bll=-10; flu=-12; fll=18 }
$flat=New-Object System.Drawing.Bitmap($MW,$MH,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$fg=[System.Drawing.Graphics]::FromImage($flat)
$fg.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor; $fg.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half; $fg.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::None
$fg.Clear([System.Drawing.Color]::Transparent)
# giunture (master); torso a riposo (angolo 0) => spalle/anche restano alle coord master
$bShx=18;$bShy=23; $fShx=26;$fShy=23; $bHipx=18;$bHipy=37; $fHipx=26;$fHipy=37; $neckx=22;$necky=19
# tank (dietro)
DrawFK $fg (PartOf 'hero_tank') 16 24 0
# braccio dietro
$bev=RotV 0 10 $P.bau; $bElbx=$bShx+$bev.x; $bElby=$bShy+$bev.y
DrawFK $fg (PartOf 'hero_backarm_up') $bShx $bShy $P.bau
DrawFK $fg (PartOf 'hero_backarm_lo') $bElbx $bElby ($P.bau+$P.bal)
# gamba dietro
$bkv=RotV 0 11 $P.blu; $bKneex=$bHipx+$bkv.x; $bKneey=$bHipy+$bkv.y
DrawFK $fg (PartOf 'hero_backleg_up') $bHipx $bHipy $P.blu
DrawFK $fg (PartOf 'hero_backleg_lo') $bKneex $bKneey ($P.blu+$P.bll)
# torso
DrawFK $fg (PartOf 'hero_torso') 22 37 0
# gamba davanti
$fkv=RotV 0 11 $P.flu; $fKneex=$fHipx+$fkv.x; $fKneey=$fHipy+$fkv.y
DrawFK $fg (PartOf 'hero_frontleg_up') $fHipx $fHipy $P.flu
DrawFK $fg (PartOf 'hero_frontleg_lo') $fKneex $fKneey ($P.flu+$P.fll)
# testa
DrawFK $fg (PartOf 'hero_head') $neckx $necky $P.head
# braccio davanti + spruzzatore
$fev=RotV 0 10 $P.fau; $fElbx=$fShx+$fev.x; $fElby=$fShy+$fev.y
DrawFK $fg (PartOf 'hero_frontarm_up') $fShx $fShy $P.fau
DrawFK $fg (PartOf 'hero_frontarm_lo') $fElbx $fElby ($P.fau+$P.fal)
$fg.Dispose()
# ritaglia al contenuto -> flat trasparente (per anteprima in gioco)
$fminx=$MW;$fminy=$MH;$fmaxx=-1;$fmaxy=-1
for($y=0;$y -lt $MH;$y++){ for($x=0;$x -lt $MW;$x++){ if($flat.GetPixel($x,$y).A -ne 0){ if($x -lt $fminx){$fminx=$x}; if($x -gt $fmaxx){$fmaxx=$x}; if($y -lt $fminy){$fminy=$y}; if($y -gt $fmaxy){$fmaxy=$y} } } }
$fcw=$fmaxx-$fminx+1; $fch=$fmaxy-$fminy+1
$flatC=New-Object System.Drawing.Bitmap($fcw,$fch,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$fcg=[System.Drawing.Graphics]::FromImage($flatC); $fcg.DrawImage($flat,(New-Object System.Drawing.Rectangle(0,0,$fcw,$fch)),$fminx,$fminy,$fcw,$fch,[System.Drawing.GraphicsUnit]::Pixel); $fcg.Dispose()
$flatC.Save((Join-Path $root "hero_assembled_flat.png"),[System.Drawing.Imaging.ImageFormat]::Png)
# anteprima in posa su sfondo rosso (scala 8)
[int]$MW=44; [int]$MH=64
$posed=New-Object System.Drawing.Bitmap([int]($MW*8),[int]($MH*8),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$pgg=[System.Drawing.Graphics]::FromImage($posed); $pgg.Clear((C "6a2733"))
$pgg.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor; $pgg.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half
$pgg.DrawImage($flat,0,0,[int]($MW*8),[int]($MH*8)); $pgg.Dispose()
$posedPath=[System.IO.Path]::GetFullPath((Join-Path $Out "preview_hero_posed.png"))
$posed.Save($posedPath,[System.Drawing.Imaging.ImageFormat]::Png)
$flat.Dispose(); $flatC.Dispose(); $posed.Dispose()
Write-Output ("POSED -> " + $posedPath)

# ---------- ANTEPRIMA 1: personaggio MONTATO (masters sovrapposti, in ordine) ----------
[int]$sc=8; [int]$MWi=[int]$MW; [int]$MHi=[int]$MH
$asm=New-Object System.Drawing.Bitmap([int]($MWi*$sc),[int]($MHi*$sc),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ag=[System.Drawing.Graphics]::FromImage($asm); $ag.Clear((C "6a2733"))
$ag.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor; $ag.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half
foreach($k in $order){ $p=$parts | Where-Object {$_.key -eq $k}; $ag.DrawImage($p.bmp,0,0,[int]($MWi*$sc),[int]($MHi*$sc)) }
$ag.Dispose()
$asmPath=[System.IO.Path]::GetFullPath((Join-Path $Out "preview_hero_assembled.png"))
$asm.Save($asmPath,[System.Drawing.Imaging.ImageFormat]::Png); $asm.Dispose()

# ---------- ANTEPRIMA 2: PEZZI singoli con perno (punto rosso) ----------
[int]$ps=6; [int]$cell=90; [int]$top=20; [int]$pad=10
[int]$cols=$order.Count
[int]$sheetH = $top + $MHi*$ps + 40
$sheet=New-Object System.Drawing.Bitmap([int]($cols*$cell), $sheetH,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg=[System.Drawing.Graphics]::FromImage($sheet); $sg.Clear((C "3a3530"))
$sg.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor; $sg.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half
$font=New-Object System.Drawing.Font("Consolas",9); $white=New-Object System.Drawing.SolidBrush((C "fff7e8")); $red=New-Object System.Drawing.SolidBrush((C "ff5a5a"))
$fmt=New-Object System.Drawing.StringFormat; $fmt.Alignment=[System.Drawing.StringAlignment]::Center
for($i=0;$i -lt $cols;$i++){
  $p=$parts | Where-Object {$_.key -eq $order[$i]}
  [int]$dw=$p.cw*$ps; [int]$dh=$p.ch*$ps
  [int]$cx=$i*$cell+[int](($cell-$dw)/2); [int]$cy=$top
  # ritaglia il crop dal master
  $sub=New-Object System.Drawing.Bitmap($p.cw,$p.ch); $subg=[System.Drawing.Graphics]::FromImage($sub); $subg.DrawImage($p.bmp,(New-Object System.Drawing.Rectangle(0,0,$p.cw,$p.ch)),$p.ox,$p.oy,$p.cw,$p.ch,[System.Drawing.GraphicsUnit]::Pixel); $subg.Dispose()
  $sg.DrawImage($sub,$cx,$cy,$dw,$dh); $sub.Dispose()
  $pv=$pivots[$order[$i]]
  $sg.FillEllipse($red, $cx+$pv[0]*$ps-2, $cy+$pv[1]*$ps-2, 5,5)     # perno
  $sg.DrawString($order[$i].Replace("hero_",""),$font,$white, ($i*$cell+$cell/2), ($top+$MHi*$ps+6), $fmt)
}
$sg.Dispose()
$partsPath=[System.IO.Path]::GetFullPath((Join-Path $Out "preview_hero_parts.png"))
$sheet.Save($partsPath,[System.Drawing.Imaging.ImageFormat]::Png); $sheet.Dispose()

Write-Output ("PARTS -> " + $root)
foreach($k in $order){ $pv=$pivots[$k]; Write-Output ("  " + $k + "  perno=(" + $pv[0] + "," + $pv[1] + ")") }
Write-Output ("ASSEMBLED -> " + $asmPath)
Write-Output ("PARTS SHEET -> " + $partsPath)
foreach($p in $parts){ $p.bmp.Dispose() }
