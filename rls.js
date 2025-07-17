// rls.js
//
// A comprehensive Node.js port of the GO release parsing library:
// https://github.com/moistari/rls
//
// This single file contains all necessary components: tag info, lexers,
// parser, builder, and data structures. It aims to be a highly accurate
// port for parsing release names.

const fs = require('fs');
const path = require('path');
const { inspect } = require('util');
const RE2 = require('re2');
const he = require('he');

// ----------------------------------------------------------------------
// 1. Embedded Data (from taginfo.csv) - (Internal)
// ----------------------------------------------------------------------

// Embedded data from taginfo.csv
const TAGINFO_CSV_DATA = `Type,Tag,Title,Regexp,Other,ReleaseType,TypeExclusive
arch,ARM64,,aarch[\\-\\_\\. ]?64|arm[\\-\\_\\. ]?64,,app,1
arch,ARM,,arm32|(?-i:ARM),,app,1
arch,64bit,,64[\\-\\_\\. ]?bit,,app,
arch,32bit,,32[\\-\\_\\. ]?bit,,app,
arch,16bit,,(?-i:16[\\-\\_\\. ]?[bB]it),,app,
arch,DARWiN,Darwin (macOS),(?-i:DARW[iI]N),,app,1
arch,ia64,Itanium,ia?64,,app,1
arch,PPC,PowerPC,,,app,1
arch,s390,IBM System/390,,,app,1
arch,x86,,x86|intel32|i32,,app,1
arch,x64,,x64|amd64,,app,1
audio,AAC-LC,Advanced Audio Coding (LC),aac[\\-\\_\\. ]?lc,,,
audio,AAC,Advanced Audio Coding,,,,
audio,AC3D,,ac[\\-\\_\\. ]?3d,,movie,
audio,Atmos,Dolby Atmos,,,movie,
audio,24BIT,,(?-i:24B[iI]T),,music,1
audio,16BIT,,,,music,1
audio,CBR,Constant Bit Rate,,,,
audio,DDPA,Dolby Digital+ Atmos (E-AC-3+Atmos),dd[p\\+]a,,movie,
audio,DDP,Dolby Digital+ (E-AC-3),dd[p\\+]|e[\\-\\_\\. ]?ac3,,movie,
audio,DD,Dolby Digital (AC-3),dd|ac3|dolby[\\-\\_\\. ]?digital,,movie,
audio,DTS-HD.HRA,DTS (HD HRA),dts[\\-\\_\\. ]?hd[\\-\\_\\. ]?hra,,movie,
audio,DTS-HD.HR,DTS (HD HR),dts[\\-\\_\\. ]?hd[\\-\\_\\. ]?hr,,movie,
audio,DTS-HD.MA,DTS (HD MA),dts[\\-\\_\\. ]?hd[\\-\\_\\. ]?ma,,movie,
audio,DTS-HD,DTS (HD),dts[\\-\\_\\. ]?hd,,movie,
audio,DTS-MA,DTS (MA),dts[\\-\\_\\. ]?ma,,movie,
audio,DTS-X,DTS (X),dts[\\-\\_\\. ]?x,,movie,
audio,DTS,,,,movie,
audio,DUAL.AUDIO,Dual Audio,dual(?:[\\-\\_\\. ]?audio)?|2audio,,movie,
audio,EAC3D,,,,,
audio,ES,Dolby Digital (ES),(?-i:ES),,movie,
audio,EX,Dolby Digital (EX),(?-i:EX),,movie,
audio,FLAC,Free Lossless Audio Codec,,,,
audio,320Kbps,320 Kbps,320[\\-\\_\\. ]?kbps,,music,1
audio,256Kbps,256 Kbps,256[\\-\\_\\. ]?kbps,,music,1
audio,192Kbps,192 Kbps,192[\\-\\_\\. ]?kbps,,music,1
audio,128Kbps,128 Kbps,128[\\-\\_\\. ]?kbps,,music,1
audio,192khz,192 khz,192[\\-\\_\\. ]?khz,,music,1
audio,96khz,96 khz,96[\\-\\_\\. ]?khz,,music,1
audio,48khz,48 khz,48[\\-\\_\\. ]?khz,,music,1
audio,44khz,44 khz,44(?:[\\-\\_\\. ]1)?[\\-\\_\\. ]?khz,,music,1
audio,LiNE,Line,(?-i:L[iI]NE),,,
audio,LOSSLESS,Lossless,,,music,1
audio,LPCM,Linear Pulse-Code Modulation (LPCM),,,,
audio,MP3,MPEG-2 Audio Layer III (MP3),,,,
audio,OGG,Vorbis Audio (OGG),,,,
audio,OPUS,Opus,,,,
audio,TrueHD,Dolby TrueHD,(?:dolby[\\-\\_\\. ]?)?true[\\-\\_\\. ]?hd,,movie,
audio,VBR,Variable Bit Rate,,,music,1
channels,7.1,,7\\.1(?:[\\-\\_\\. ]?audios?)?,,,
channels,7.0,,7\\.0(?:[\\-\\_\\. ]?audios?)?,,,
channels,6.1,,6\\.1(?:[\\-\\_\\. ]?audios?)?,,,
channels,6.0,,6\\.0(?:[\\-\\_\\. ]?audios?)?,,,
channels,5.1,,5\\.1(?:[\\-\\_\\. ]?audios?)?,,,
channels,5.0,,5\\.0(?:[\\-\\_\\. ]?audios?)?,,,
channels,4.1,,4\\.1(?:[\\-\\_\\. ]?audios?)?,,,
channels,4.0,,4\\.0(?:[\\-\\_\\. ]?audios?)?,,,
channels,3.1,,3\\.1(?:[\\-\\_\\. ]?audios?)?,,,
channels,3.0,,3\\.0(?:[\\-\\_\\. ]?audios?)?,,,
channels,2.1,,2\\.1(?:[\\-\\_\\. ]?audios?)?,,,
channels,2.0,,2\\.0(?:[\\-\\_\\. ]?audios?)?,,,
channels,1.0,,1\\.0(?:[\\-\\_\\. ]?audios?)?,,,
codec,DiVX.SBC,DivX SBC,(?:divx[\\-\\_\\. ]?)?sbc,,movie,
codec,x264.HQ,x264 (HQ),x[\\-\\_\\. ]?264[\\-\\_\\. ]?hq,,movie,
codec,MPEG-2,,mpe?g(?:[\\-\\_\\. ]?2)?,,movie,
codec,H.265,,h[\\-\\_\\. ]?265,,movie,
codec,H.264,,h[\\-\\_\\. ]?264,,movie,
codec,H.263,,h[\\-\\_\\. ]?263,,movie,
codec,H.262,,h[\\-\\_\\. ]?2[26]2,,movie,
codec,H.261,,h[\\-\\_\\. ]?261,,movie,
codec,dxva,Direct-X Video Acceleration,,,movie,
codec,HEVC,High Efficiency Video Coding,,,movie,
codec,VC-1,,vc[\\-\\_\\. ]?1,,movie,
codec,x265,,x[\\-\\_\\. ]?265,,movie,
codec,x264,,x[\\-\\_\\. ]?264,,movie,
codec,XViD,Xvid,,,movie,
codec,AVC,Advanced Video Coding,avc(?:[\\-\\_\\. ]?1)?,,movie,
codec,VP9,,vp[\\-\\_\\. ]?9,,movie,
codec,VP8,,vp[\\-\\_\\. ]?8,,movie,
codec,VP7,,vp[\\-\\_\\. ]?7,,movie,
collection,ABC,American Broadcasting Company,,,,
collection,ACA.NEOGEO,Neo Geo Classics,aca[\\-\\_\\. ]?neo[\\-\\_\\. ]?geo,,game,1
collection,ALL4,All 4,,,,
collection,AMZN,Amazon,amzn|amazon(?:hd)?,,,
collection,Apress,,,,education,1
collection,ArtStation,,art[\\-\\_\\. ]?station(?:[\\-\\_\\. ]?com)?,,education,1
collection,AT-X,Anime Theatre X,at[\\-\\_\\. ]?x,,series,
collection,ATVP,Apple TV+,atv[p\\+],,,
collection,B-Global,Bilibili Global,b[\\-\\_\\. ]?global,,,
collection,BBC,British Broadcasting Corporation,,,,
collection,BCORE,Bravia Core,,,movie,1
collection,BOOM,Boomerang,,,,
collection,BRAVO,Bravo,(?-i:BRAVO?),,,
collection,Career.Academy,Career Academy,career[\\-\\_\\. ]?academy,,education,1
collection,CBC,Canadian Broadcasting Corporation,,,,
collection,CBS,CBS Corporation,,,,
collection,CBT.Nuggets,CBT Nuggets,cbt[\\-\\_\\. ]?nuggets(?:[\\-\\_\\. ]?com)?,,education,1
collection,CC,Comedy Central,,,,
collection,CPOP,Chinese Pop,,,music,1
collection,CRAV,Crave,,,,
collection,CreativeLive,,,,education,1
collection,Criterion.Collection,Criterion Collection,(?:the[\\-\\_\\. ])?(?:criterion(?:[\\-\\_\\. ]?(?:collection|edition))?),,movie,
collection,CRKL,Crackle,,,,
collection,CR,Crunchyroll,,,,
collection,CW,The CW,,,,
collection,CX,Fuji TV,,,,
collection,DCU,DC Universe,,,,
collection,DI.FM,Digitally Imported FM,di[\\-\\_\\. ]?fm,,music,1
collection,DigitalTutors,,digital[\\-\\_\\. ]?tutors(?:[\\-\\_\\. ]?com)?,,education,1
collection,DSCP,Discovery+,dsc[p\\+],,,
collection,DSNP,Disney+,dsn[p+],,,
collection,DSNY,Disney,,,,
collection,eShop,Nintendo eShop,,,game,1
collection,FBWatch,Facebook Watch,,,,
collection,FE,Freeform,,,,
collection,3FM,NPO 3FM,,,music,1
collection,FOX,Fox Broadcasting Company,(?-i:FOX),,,
collection,FREEWEB,Freeweb,,,music,1
collection,FUNi,Funimation,,,,
collection,GOG,Good Old Games,gog(?:[\\-\\_\\. ]?(?:edition|classic))?,,game,1
collection,Gumroad,,gum[\\-\\_\\. ]?road(?:[\\-\\_\\. ]?com)?,,education,1
collection,Hitradio.MSOne,Hitradio MS One,hitradio[\\-\\_\\. ]?ms[\\-\\_\\. ]?one,,music,1
collection,HMAX,HBO Max,,,,
collection,HTSR,Hotstar,,,,
collection,HULU,Hulu Networks,,,,
collection,IBM.Press,IBM Press,ibm[\\-\\_\\. ]?press,,education,1
collection,IDT.Radio,ID&T Radio,idt[\\-\\_\\. ]?radio,,music,1
collection,iGN.com,,ign\\.com,,,
collection,IMAX,,(?-i:IMAX),,,
collection,iPlayer,BBC iPlayer,(?-i:iP)(?:layer)?,,,
collection,iTunes,,(?-i:iT)(?:unes)?,,,
collection,JAV,Japanese Adult Video,,,,
collection,JPOP,Japanese Pop,,,music,1
collection,KelbyOne,,kelby(?:[\\-\\_\\. ]?(?:one|training))?,,education,1
collection,Learnable.com,,learnable[\\-\\_\\. ]?com,,education,1
collection,LearnNowOnline,,,,education,1
collection,LinkedIn.Learning,LinkedIn Learning,linkedin[\\-\\_\\. ]?learning,,education,1
collection,LinuxCBT,,linux[\\-\\_\\. ]?cbt(?:[\\-\\_\\. ]?com)?,,education,1
collection,Lynda,,lynda(?:[\\-\\_\\. ]?com)?,,education,1
collection,MTV,MTV Networks,,,,
collection,MUBI,Mubi,,,,
collection,NBC,National Broadcasting Company,,,,
collection,NF,Netflix,(?-i:NF)|netflix(?:[\\-\\_\\. ]originals)?,,,
collection,NHKG,NHK General TV,,,,
collection,NICK,Nickelodeon,(?-i:N[iI]CK),,,
collection,OAR,Original Aspect Ratio,(?-i:OAR),,,
collection,OREILLY,O'Reilly,o[\\-\\_\\. ]?reilly(?:[\\-\\_\\. ]?com)?,,education,
collection,Packt,,,,education,1
collection,PCOK,Peacock,,,,
collection,Percipio,,percipio(?:[\\-\\_\\. ]?com)?,,education,1
collection,PLURALSiGHT,Pluralsight,plural[\\-\\_\\. ]?sight(?:[\\-\\_\\. ]?com)?,,education,1
collection,PMTP,Paramount+,pmt[p\\+],,,
collection,PPV,Pay-Per-View,ppv(?:[\\-\\_\\. ]?rip)?,,episode,
collection,PSN,PlayStation Network,,,game,1
collection,Puresound.FM,Puresound FM,puresound[\\-\\_\\. ]?fm,,music,1
collection,RED,YouTube Red,(?-i:RED),,,
collection,ROKU,Roku,,,,
collection,SF,Shout! Factory,(?-i:SF),,,
collection,SiriusXM,Sirius XM,sirius[\\-\\_\\. ]?xm,,music,1
collection,Skillfeed,,,,education,1
collection,Skillshare,,skillshare(?:[\\-\\_\\. ]?com)?,,education,1
collection,Sonic.Academy,Sonic Academy,sonic[\\-\\_\\. ]?academy(?:[\\-\\_\\. ]?com)?,,education,1
collection,STAN,Stan,,,,
collection,STV,Straight-to-Video,,,movie,
collection,STZ,STARZ,st(?:ar)?z,,,
collection,Total.Training,Total Training,total[\\-\\_\\. ]?training,,education,1
collection,TrainSignal,,,,education,1
collection,TrainSimple,,train[\\-\\_\\. ]?simple(?:[\\-\\_\\. ]?com)?,,education,1
collection,Truefire,,truefire(?:[\\-\\_\\. ]?com)?,,education,1
collection,TutsPlus,,tutsplus(?:[\\-\\_\\. ]?com)?,,education,1
collection,TVNZ,Television New Zealand,,,,
collection,Udemy,,,,education,1
collection,Video2Brain,,video2brain(?:[\\-\\_\\. ]?com)?,,education,1
collection,VMEO,Vimeo,,,,
collection,VRV,Verve Streaming,,,,
collection,VTC,,,,education,1
collection,WAKA,Wakanim,(?-i:WAKA),,,
collection,WiiWare,WiiWare Shop,,,game,1
collection,Wiley,,wiley(?:[\\-\\_\\. ]?com)?,,education,1
collection,XBLA,Xbox Live Arcade,,,game,1
collection,XXX,Adult,(?-i:XXX),,,
collection,YOUTUBE,YouTube,(?-i:YOUTUBE)|(?-i:YT),,,
collection,ZEE5,ZEE5 Streaming,,,,
container,AVI,Audio Video Interleave (AVI),,,,
container,AZW3,Kindle eBook (AZW),azw3?,,book,
container,CBR,Comic Book Archive (CBR),,,comic,
container,CBZ,Comic Book Archive (CBZ),,,comic,
container,DIVX,DivX,,,movie,
container,ePub,Electronic Publication (ePub),,,book,
container,FLV,Flash Video,,,movie,
container,F4V,Flash 4 Video (F4V),,,movie,
container,ISO,ISO 9660,,,,
container,3LP,,,,movie,
container,MKV,Matroska (MKV),,,movie,
container,MOBI,Mobipocket eBook (MOBI),,,book,
container,MOV,QuickTime Movie,,,movie,
container,MP4,MPEG-4 Part 14 (MP4),,,movie,
container,M4V,,,,movie,
container,PDF,Portable Document Format (PDF),,,book,
container,WMV,Windows Media Video (WMV),,,movie,
cut,Censored.Cut,Censored,censored(?:[\\-\\_\\. ]cut)?,,movie,
cut,Directors.Cut,Director's,director[\\-\\_\\. ']?s[\\-\\_\\. ]cut|(?-i:DC),,movie,
cut,Extended.Cut,Extended,extended(?:[\\-\\_\\. ](?:version|edition|cut))?,,,
cut,Final.Cut,Final,final[\\-\\_\\. ]cut,,movie,
cut,International.Cut,International,international[\\-\\_\\. ]cut,,movie,
cut,Original.Version,Original,original[\\-\\_\\. ](?:version|edition|cut),,,
cut,Theatrical.Cut,Theatrical,theatrical(?:[\\-\\_\\. ]cut)?,,movie,
cut,Uncensored.Cut,Uncensored,uncensored(?:[\\-\\_\\. ]cut)?,,movie,
cut,Uncut,,uncut|ungek[uü]e?rzt,,movie,
cut,Unrated.Cut,Unrated,unrated(?:[\\-\\_\\. ]cut)?,,movie,
edition,Bonus.Edition,Bonus,bonus[\\-\\_\\. ]edition,,music,1
edition,Club.Edition,Club,club[\\-\\_\\. ]edition,,music,1
edition,Collectors.Edition,Collectors,collector[[\\-\\_\\. ']?s[\\-\\_\\. ]edition,,movie,
edition,Complete.Edition,Complete,(?-i:Complete[\\-\\_\\. ]Edition),,game,1
edition,Definitive.Edition,Definitive,(?:the[\\-\\_\\. ])?definitive[\\-\\_\\. ]edition,,game,1
edition,Deluxe.Edition,Deluxe,deluxe[\\-\\_\\. ]edition,,,
edition,Despecialized,,,,movie,1
edition,Expanded.Edition,Expanded,expanded(?:[\\-\\_\\. ](?:version|edition|cut))?,,movie,
edition,Extended.Mix,Extended Mix,(?:incl[\\-\\_\\. ]+)?extended[\\-\\_\\. ]mix,,music,1
edition,Fan.Edit,Fan,fan[\\-\\_\\. ]edit,,movie,1
edition,JA,Japanese Edition,(?-i:JA),,music,1
edition,Limited.Edition,Limited,limited(?:[\\-\\_\\. ]edition)?,,,
edition,Ltd.Ed,Limited,ltd[\\-\\_\\. ][\\-\\_\\. ]?ed,,music,1
edition,Noir.Edition,Noir,noir[\\-\\_\\. ]edition,,movie,1
edition,Open.Matte,Open Matte,open[\\-\\_\\. ]matte,,movie,1
edition,Remastered.Edition,Remastered,remaster(?:ed)?(?:[\\-\\_\\. ]edition)?,,,
edition,Restored.Edition,Restored,restored(?:[\\-\\_\\. ]edition)?,,movie,
edition,Special.Edition,Special,special[\\-\\_\\. ]edition|edicion[\\-\\_\\. ]especial,,movie,
edition,Super.Deluxe,Super Deluxe,super[\\-\\_\\. ]deluxe,,movie,
edition,Ultimate.Edition,Ultimate,ultimate[\\-\\_\\. ]edition,,movie,
edition,$1.Anniversary.Edition,Anniversary ($1),(\\d+(?:th|st|nd|rd)?)?[\\-\\_\\. ]anniversary(?:[\\-\\_\\. ]edition)?,,movie,
ext,aac,Advanced Audio Coding (aac),(?-i:aac),,music,
ext,asf,Advanced Systems Format (asf),,,movie,
ext,asx,Advanced Stream Redirector (asx),,,movie,
ext,avc,Advanced Video Coding (avc),,,movie,
ext,avi,Audio Video Interleave (avi),,,movie,
ext,bin,Binary (bin),,,app,
ext,bz2,BZip2 (bz2),,,app,
ext,cbr,Comic Book (CBR),,,comic,1
ext,cbz,Comic Book (CBZ),,,comic,1
ext,dat,Data (dat),,,app,
ext,divx,DivX,[bd]ivx,,movie,
ext,dvr-ms,Microsoft Digital Video Recording (dvr-ms),,,movie,
ext,flac,Free Lossless Audio Codec (flac),(?-i:flac),,music,
ext,fli,FLIC Animation (fli),,,movie,
ext,flv,FLV,,,movie,
ext,3gp,3rd Generation Partnership Project (3gp),,,movie,
ext,gz,GZip (gz),,,app,
ext,ifo,IFO,,,movie,
ext,img,IMG,,,app,
ext,iso,ISO 9660 (iso),,,,
ext,m4a,MPEG-4 Audio (m4a),,,music,
ext,mk3d,MK3D,,,movie,
ext,mkv,Matroska (mkv),,,movie,
ext,mov,MOV,,,movie,
ext,mp4,MP4,(?-i:mp4),,movie,
ext,mp3,MP3,(?-i:mp3),,music,
ext,mpg,MPEG,mpe?g,,movie,
ext,m2ts,BluRay Disc (m2ts),,,movie,
ext,m3u,M3U,,,music,
ext,m4v,M4V,,,movie,
ext,m2v,M2V,,,movie,
ext,nrg,NRG,,,app,
ext,nsv,NSV,,,movie,
ext,nuv,NUV,,,movie,
ext,ogm,OGM,,,movie,
ext,ogv,OGV,,,movie,
ext,pva,PVA,,,series,
ext,qt,QuickTime (qt),,,movie,
ext,rar,Roshal Archive (rar),,,,
ext,raw,RAW,,,movie,
ext,rmvb,Real Media (rmvb),,,movie,
ext,rm,Real Media (rm),,,movie,
ext,strm,Stream (strm),,,game,1
ext,svq3,SVQ3,,,movie,
ext,tar.bz2,BZip2 TAR (tar.bz2),,,app,
ext,tar.gz,GZip TAR (tar.gz),,,app,
ext,tar,TAR,,,app,
ext,torrent,Torrent,,,,
ext,ts,TS,,,movie,
ext,ty,TY,,,movie,
ext,viv,VIV,,,movie,
ext,vob,VOB,,,movie,
ext,vp3,VP3,,,movie,
ext,webm,WebM,,,movie,
ext,wmv,WMV,,,movie,
ext,wpl,WPL,,,music,
ext,wtv,WTV,,,movie,
ext,xvid,Xvid,,,movie,
ext,7z,7-Zip (7z),,,app,
ext,zip,Zip,,,,
genre,Action,,,,movie,
genre,Adventure,,,,movie,
genre,Animation,,,,movie,
genre,Anime,,,(?-i:AN[iI]ME),movie,
genre,Biography,,,,movie,
genre,Comedy,,,,movie,
genre,Concert,,,,movie,
genre,Crime,,,,movie,
genre,Documentary,,do[ck](?:u(?:mentary)?)?,(?-i:DO[CK]U?),movie,
genre,Drama,,,,movie,
genre,Family,,,,movie,
genre,Fantasy,,,,movie,
genre,Film-Noir,,film[\\-\\_\\. ]?noir,,movie,
genre,Food,,,,movie,
genre,Game-Show,,game[\\-\\_\\. ]?show,,series,
genre,History,,,,movie,
genre,Horror,,,,movie,
genre,Musical,,,,movie,
genre,Music,,,,movie,
genre,Mystery,,,,movie,
genre,News,,,,series,
genre,Reality-TV,,reality[\\-\\_\\. ]?tv,,series,
genre,Romance,,,,movie,
genre,Sci-Fi,,sci[\\-\\_\\. ]?fi|science[\\-\\_\\. ]?fiction,,movie,
genre,Short,,,,movie,
genre,Sport,,,,movie,
genre,Stand-Up,,stand[\\-\\_\\. ]?up,,movie,
genre,Talk-Show,,talk[\\-\\_\\. ]?show,,series,
genre,Thriller,,,,movie,
genre,Travel,,,,movie,
genre,War,,,,movie,
genre,Western,,,,movie,
hdr,HDR10+,High Dynamic Range (10-bit+),hdr[\\-\\.]?10\\+|10\\+[\\-\\.]?bit|hdr10plus|hi10p,,movie,
hdr,HDR10,High Dynamic Range (10-bit),hdr[\\-\\.]?10|10[\\-\\.]?bit|hi10,,movie,
hdr,HDR+,High Dynamic Range+,hdr\\+,,movie,
hdr,HDR,High Dynamic Range,,,movie,
hdr,HLG,Hybrid Log-Gamma,,,movie,
hdr,SDR,Standard Dynamic Range,,,movie,
hdr,DV,Dolby Vision,dolby[\\-\\_\\. ]vision|dovi|dv,,movie,
language,AUDiO.ADDON,Audio Addon,audio[\\-\\_\\. ]?addon,,,
language,BALTIC,Baltic,,,,
language,BRAZiLiAN,Brazilian,BRAZiLiAN|BR,,,
language,BULGARiAN,Bulgarian,(?i:bulgarian)|BG,,,
language,CHiNESE,Chinese,CH[iI]N[eE]S[eE]|CN,,,
language,CHS,Chinese (simplified),(?i:chinese[\\-\\_\\. ]?simplified)|CHS,,,
language,CHT,Chinese (traditional),(?i:chinese[\\-\\_\\. ]?traditional)|CHT,,,
language,CZECH,Czech,CZECH|CZ,,,
language,DANiSH,Danish,(?i:danish)|DK,,,
language,DL,Dual Language,(?i:dual[\\-\\_\\. ]?language)|DL,,,
language,DUBBED,Dubbed,(?i:(?:line[\\-\\_\\. ]?)?dubbed),,,
language,DUTCH,Dutch,(?i:dutch|flemish)|NL,,,
language,ENGLiSH,English,(?i:eng(?:lish)?)|EN,,,
language,ESTONiAN,Estonian,(?i:estonian)|EE,,,
language,FiNNiSH,Finnish,(?i:finnish)|FI,,,
language,FRENCH,French,(?i:french)|FRE|FR,,,
language,GERMAN,German,(?i:german)|DE,,,
language,GREEK,Greek,GREEK|(?i:gr),,,
language,HAiTiAN,Hatian,(?i:haitian)|HT,,,
language,HARDSUB,Subs (hard),(?:hardsub),,,
language,HC,Hardcoded,(?i:hard[\\-\\_\\. ]?coded|hc),,,
language,HiNDI,Hindi,(?i:hindi)|HI,,,
language,HUNGARiAN,Hungarian,(?i:hun(?:garian)?)|HU,,,
language,iCELANDiC,Icelandic,(?i:icelandic),,,
language,iTALiAN,Italian,(?i:ita(?:lian)?),,,
language,JAPANESE,Japanese,(?i:japanese),,,
language,KOREAN,Korean,K[oO]R[eE][aA]N|KR,,,
language,LATiN,Latin,,,,
language,MANDARiN,Mandarin,,,,
language,MULTILANG,Multi (lang),,,,
language,MULTiSUB,Subs (multi),(?i:multiple[\\-\\_\\. ]subtitles?|multi[\\-\\_\\. ]?subs?),,,
language,MULTi,Multi,(?i:multi(?:[\\-\\_\\. ]?(?:lingual|language)))|MULT[iI],,,
language,NORDiC,Nordic,N[oO]RD[iI]C,,,
language,NORWEGiAN,Norwegian,(?i:nor(?:wegian)?)|NO,,,
language,POLiSH,Polish,(?i:polish)|PL,,,
language,PORTUGUESE,Portuguese,(?i:portuguese)|PT,,,
language,ROMANiAN,Romanian,(?i:romanian)|RO,,,
language,RUSSiAN,Russian,(?i:rus(?:sian)?)|RU,,,
language,SLOVAK,Slovak,SLOVAK|SK,,,
language,SPANiSH,Spanish,(?i:spanish)|SPA|ES,,,
language,SUBBED,Subbed,(?i:subbed),,,
language,SUBFORCED,Subbed (forced),(?i:subforced|forcedsub),,,
language,SUBPACK,Subs (pack),(?i:subs?[\\-\\_\\. ]?pack),,,
language,SWEDiSH,Swedish,(?i:swe(?:dish)?)|SE,,,
language,SYNCED,Synced,(?i:synced),,,
language,TURKiSH,Turkish,(?i:turkish)|TR,,,
language,UKRAiNiAN,Ukrainian,(?i:ukrainian)|UA,,,
language,UNSUBBED,Unsubbed,(?i:unsubbed),,,
language,VF2,VFF et VFQ,(?i:vf2|fr2),,,
language,VFB,Version Francophone Belge,(?i:vfb),,,
language,VFF,Version Francophone Français,(?i:vf?f|truefrench),,,
language,VFI,Version Francophone Internationale,(?i:vfi),,,
language,VFO,Version Francophone Originale,(?i:vf?o),,,
language,VFQ,Version Francophone Québécoise,(?i:vf?q),,,
language,VOSTEN,Version Originale Sous-Titrée en Anglais,(?i:vosten),,,
language,VOSTFR,Version Originale Sous-Titrée en Français,(?i:vostfr),,,
language,YUGOSLOViAN,Yugoslovian,(?i:yugoslovian)|YU,,,
language,$1$2UB$3,$2ubs ($1$3),([A-Zi]*)([SD])UB([A-Zi]*),,,
language,MULTi$2,Multi ($2),(?i:multi)[\\-\\_\\. ]?(\\d+),,,
other,ADVANCE,Advance,adv(?:anced?)?,,music,1
other,AI.Upscale,Upscaled (AI),ai[\\-\\_\\. ]upscaled?,,movie,
other,All.Access.Cheat,All Access Cheat,all[\\-\\_\\. ]access[\\-\\_\\. ](?:cheats?|save),,game,1
other,BONUS.TRACKS,Bonus Tracks,bonus[\\-\\_\\. ]tracks?,,music,1
other,BONUS,Bonus,(?-i:BONUS),,,
other,BOOKWARE,Bookware,,,education,1
other,BOOTLEG,Bootleg,,,music,1
other,BOXSET,Boxset,,,series,
other,CFW,Custom Firmware,,,game,1
other,COMMENTARY,Commentary,(?:with[\\-\\_\\. ])commentary|(?-i:C[oO]MM[eE]NT[aA]RY),,movie,
other,COMPLETE,Complete,,,movie,
other,CONVERT,Convert,(?-i:CONVERT),,,
other,COVER,Cover,(?-i:C[oO]V[eE]RS?),,,
other,CRACKED,Cracked,,,app,
other,CRACKFiX,Fix (crack),crack[\\-\\_\\. ]?fix,,app,
other,CUSTOM,Custom,(?-i:C[uU]ST[oO]M),,,
other,3D,,,,movie,1
other,Digital.Extras,Extras (digital),digital[\\-\\_\\. ]extras,,movie,
other,DIRFIX,Fix (directory),dir[\\-\\_\\. ]?[df]ix?,,,
other,Discography,,,,music,1
other,DLC,,(?:(?:plus|including|incl|inc)[\\-\\_\\. ]?)?dlc(?:[\\-\\_\\. ]unlocker)?,,game,1
other,DNR,Digital Noise Reduction,(?-i:DNR),,movie,1
other,DOX,Dox,,,,
other,EAC,Exact Audio Copy,(?-i:EAC),,music,1
other,EXTRAS,Extras,(?:(?:plus|including|incl|inc)[\\-\\_\\. ]?)?extras(?:[\\-\\_\\. ]?only)?,,,
other,FiNAL,Final,(?-i:F[iI]N[aA]L),,,
other,FiX,Fix,(?-i:F[iI]X),,,
other,FS,Fullscreen,(?-i:FS),,,
other,Half-SBS,3D (half side-by-side),h(?:alf)?[\\-\\_\\. ]?sbs,,movie,1
other,HAPPY.NEW.YEAR,Holiday (new year),(?-i:HAPPY[\\-\\_\\. ]NEW[\\-\\_\\. ]YEARS?),,,
other,HiGHLiGHTS,Highlights,(?-i:H[iI]GHL[iI]GHTS),,,
other,HiRES,High Resolution,(?-i:H[iI]RES),,,
other,HOTFiX,Hotfix,hot[\\-\\_\\. ]?fix,,app,
other,HOU,3D (half-over/half-under),,,movie,1
other,HR,High Res,high[\\-\\_\\. ]?res|hr,,movie,
other,HYBRiD,Hybrid,,,movie,
other,IMAGESET,Image Set,image[\\-\\_\\. ]?set,,,
other,IMPORT,Import,,,music,1
other,Incl.Crack,Crack,(?:(?:incl?|and)[\\-\\_\\. ]?)?crack(?:[\\-\\_\\. ](?:only|for))?,,app,
other,Incl.Keygen,Keygen,(?:(?:incl?|and)[\\-\\_\\. ])?key[\\-\\_\\. ]?(?:generator|gen|(?:(?:file[\\-\\_\\. ])?)?maker)(?:[\\-\\_\\. ](?:only|for))?,,app,
other,Incl.Offline.Crack,Offline Crack,(?:(?:incl?|and)[\\-\\_\\. ]?)?offline[\\-\\_\\. ]?crack(?:[\\-\\_\\. ](?:only|for))?,,app,
other,Incl.Patchtool,Patchtool,(?:(?:incl?|and)[\\-\\_\\. ]?)?patch[\\-\\_\\. ]?tool(?:[\\-\\_\\. ](?:only|for))?,,app,
other,Incl.Patch,Patch,(?:(?:incl?|and)[\\-\\_\\. ]?)?patch(?:[\\-\\_\\. ](?:only|for))?,,app,
other,Incl.Serial,Serial,(?:(?:incl?|and)[\\-\\_\\. ]?)?serial(?:[\\-\\_\\. ](?:only|for))?,,app,
other,iNJECT,Console Inject,(?-i:[iI]NJ[eE]CT),,game,1
other,INTERNAL,Internal,(?-i:[iI]NT)|internal,int,,
other,JB,Jailbroken,(?-i:JB),,game,1
other,KONTAKT,Samples (Kontakt),(?-i:KONTAKT),,music,1
other,LD,Line Dubbed,,,,
other,MD,Mic Dubbed,(?-i:MD),,,
other,MERRY.XMAS,Holiday (xmas),(?-i:.ERRY[\\-\\_\\. ](?:XMAS|CHRISTMAS)),,,
other,minimalNR,Minimal Noise-Reduction,minimal[\\-\\_\\. ]?nr,,movie,1
other,MOViE.PACK,Movie Pack,movie[\\-\\_\\. ]?pack,,movie,1
other,MULTiFORMAT,Multiformat,,,music,1
other,NFOFiX,Fix (nfo),i?nfo[\\-\\_\\. ]?fix,,,
other,no-DNR,No Digital Noise Reduction,no[\\-\\_\\. ]?dnr,,movie,1
other,NoCD,Crack (no CD),,,game,1
other,NUKED,Nuked,nuked?,,,
other,ONESIDED,Vinyl (onesided),,,music,1
other,OST,Soundtrack (OST),(?:original[\\-\\_\\. ](?:motion[\\-\\_\\. ]picture[\\-\\_\\. ])?)?soundtrack|ost,,music,1
other,PATCHED,Patched,,,app,
other,PROMO,Promo,,,music,
other,PROOFFiX,Fix (proof),,,,
other,PROOF,Proof,(?-i:PROOF),,,
other,PROPER,Proper,,,,
other,RARFiX,Fix (rar),,,,
other,READNFO,Read NFO,read[\\-\\_\\. ]?i?nfo,,,
other,REAL.PROPER,Proper (real),real[\\-\\_\\. ]?proper,,,
other,REAL,Real,(?-i:REAL),,,
other,REGiSTERED,Registered,registered|regged,,app,1
other,REISSUE,Reissue,,,music,
other,REMAKE,Remake,(?-i:REMAKE),,,
other,REMASTERED,Remastered,remaster(?:ed)?,,,
other,REMiX,Remix,(?:re[\\-\\_\\. ]?)?mix(?:e[sd])?(?:[\\-\\_\\. ]edition)?,,music,1
other,REMUX,Remux,,,,
other,REPACK,Repack,repack(?:ed)?,,,
other,RERELEASE,Re-release,re[\\-\\_\\. ]?release,,music,1
other,REREPACK,Re-repack,rerepack|repack2,,,
other,RERiP,Re-rip,re[\\-\\_\\. ]?rip,,,
other,RESTORATiON,Restoration,,,movie,
other,RETAiL,Retail,,,,
other,RiP,Rip,(?-i:RiP),,,
other,SAMPLEFiX,Fix (sample),,,movie,
other,SAMPLER,Sampler,(?:album[\\-\\_\\. ]?)?sampler,,music,1
other,SBS,3D (side-by-side),,,movie,1
other,SCRUBBED,Scrubbed,,,game,1
other,Serial.Fix,Fix (serial),serial[\\-\\_\\. ]?fix,,app,
other,Special.Features,Special Features,(?:(?:with|incl?)?[\\-\\_\\. ])?special[\\-\\_\\. ]features,,movie,
other,Strategy.Guide,Strategy Guide,strategy[\\-\\_\\. ]?guide,,book,1
other,SUB100,Sub 100,sub[\\-\\_\\. ]?100,,app,
other,SYNCFiX,Fix (sync),,,movie,
other,TRACKFiX,Fix (track),track[\\-\\_\\. ]?fix,,music,1
other,TUTORiAL,Tutorial,(?-i:T[uU]T[oO]R[iI][aA]L),,education,1
other,UNRELEASED,Unreleased,,,music,1
other,UPDATE,Update,,,app,
other,UPSCALED,Upscaled,upscaled?,,movie,1
other,VC,Virtual Console,,,game,1
other,VERTICAL,Vertical,(?-i:V[eE]RT[iI]C[aA]L),,,
other,Virtual.Crack,Crack (virtual),virtual[\\-\\_\\. ]?crack,,game,1
other,VIRUS.FREE,,virus[\\-\\_\\. ]free,,app,
other,VR180,,vr[\\-\\_\\. ]?180,,movie,
other,VR,,,,movie,
other,WORKING,Working,(?-i:W[oO]RK[iI]NG),,app,
other,WS,Widescreen,widescreen|ws,,movie,
other,$1X,,((?:19|20)[\\d|x])x,,music,1
other,Plus.$2.Trainer,Trainer ($2),(?:plus[\\-\\_\\. ])?(\\d\\d?)[\\-\\_\\. ]?trainer,,game,1
platform,AIX,,,,app,1
platform,ANDROiD,Android,(?-i:ANDRO[iI]D),,app,
platform,DOS,,(?-i:DOS),,app,1
platform,3DS,Nintendo 3DS,(?-i:3DS),,game,1
platform,DSi,Nintendo DSi,,,game,1
platform,FC,Nintendo Famicom,,,game,1
platform,FreeBSD,,free[\\-\\_\\. ]?bsd,,app,1
platform,GBA,Nintendo Gameboy Advanced,,,game,1
platform,GB,Nintendo Gameboy,,,game,1
platform,GCN,Nintendo GameCube (North America),,,game,1
platform,HP-UX,,hp[\\-\\_\\. ]?ux,,app,1
platform,IRIX,,,,app,1
platform,Linux,,,,app,
platform,MacOSX,,(?:mac[\\-\\_\\. ]?)?osx,,app,
platform,MacOS,,mac[\\-\\_\\. ]?os,,app,
platform,MEGACD,Sega Mega-CD,[ms]ega[\\-\\_\\. ]?cd,,game,1
platform,MultiOS,Multi OS,,,app,1
platform,N64,Nintendo 64,,,game,1
platform,NDS,Nintendo DS,,,game,1
platform,NES,Nintendo Entertainment System,,,game,1
platform,NGC,Nintendo GameCube (Japan),,,game,1
platform,NGPC,Neo Geo Pocket Color,,,game,1
platform,NG,Neo Geo,ng|neo[\\-\\_\\. ]?geo,,game,1
platform,NSW,Nintendo Switch,ns[wp]|xci,,game,1
platform,OpenBSD,,open[\\-\\_\\. ]?bsd,,app,1
platform,PC,,(?-i:PC),,app,
platform,PS5,PlayStation 5,ps[\\-\\_\\. ]?5,,game,1
platform,PS4,PlayStation 4,ps[\\-\\_\\. ]?4,,game,1
platform,PS3,PlayStation 3,ps[\\-\\_\\. ]?3,,game,1
platform,PS2,PlayStation 2,ps[\\-\\_\\. ]?(?:2|rip),,game,1
platform,PS1,PlayStation 1,ps[\\-\\_\\. ]?[x1]|(?-i:PS),,game,1
platform,PSP,PlayStation Portable,,,game,1
platform,PSV,PlayStation Vita,psv(?:ita)?,,game,1
platform,SFC,Nintendo Super Famicom,,,game,1
platform,SNES,Super Nintendo Entertainment System,,,game,1
platform,Solaris.Intel,Solaris (Intel),solaris[\\-\\_\\. ]intel,,app,1
platform,Solaris.Sparc,Solaris (SPARC),solaris[\\-\\_\\. ]sparc,,app,1
platform,TG16,TurboGrafx 16,tg[\\-\\_\\. ]?16|pce(?:[\\-\\_\\. ]?(?:cd))?,,game,1
platform,VVD,V.Flash (VTech V.Disc),,,game,1
platform,WiiU,Nintendo Wii U,wii[\\-\\_\\. ]?u,,game,1
platform,Wii,Nintendo Wii,,,game,1
platform,Win95NT4,Windows 95/NT4,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?95[\\-\\_\\. ]?nt4,,app,
platform,Win9xNT4,Windows 9x/NT4,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?9x[\\-\\_\\. ]?nt4,,app,
platform,Win95NT,Windows 95/NT,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?95[\\-\\_\\. ]?nt,,app,
platform,Win9xNT,Windows 9x/NT,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?9x[\\-\\_\\. ]?nt,,app,
platform,Win311,Windows 3.11,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?3[\\-\\_\\. ]?11,,app,
platform,WinAll,Windows (all),(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?all,,app,
platform,WinNT4,Windows NT4,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?nt4,,app,
platform,Win98,Windows 98,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?98,,app,
platform,Win95,Windows 95,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?95,,app,
platform,Win64,Windows (x64),(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?64,,app,
platform,Win32,Windows (x86),(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?32,,app,
platform,WinME,Windows ME,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?me,,app,
platform,WinNT,Windows NT,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?nt,,app,
platform,WinPE,Windows PE,(based[\\-\\_\\. ]on[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?pe,,app,
platform,Win9x,Windows 9x,(for[\\-\\_\\. ])?(?:windows|win)[\\-\\_\\. ]?9x,,app,
platform,XBOX360,Xbox 360,xbox[\\-\\_\\. ]?360,,game,1
platform,XBOXONE,Xbox One,xbox[\\-\\_\\. ]?one,,game,1
platform,XBOX,Xbox,xbox(?:rip)?,,game,1
region,R0,Global (R0),,,movie,
region,R1,United States (R1),,,movie,
region,R2,Europe (R2),,,movie,
region,R3,Southeast Asia (R3),,,movie,
region,R4,Latin America (R4),,,movie,
region,R5,Africa (R5),,,movie,
region,R6,China (R6),,,movie,
region,R7,Media (R7),,,movie,
region,R8,International (R8),,,movie,
region,R9,Any (R9),,,movie,
region,UK,United Kingom,(?-i:UK),,,
region,AUS,Australia,(?-i:AUS),,,
region,CAN,Canada,(?-i:CAN),,,
region,CEE,Central and Eastern Europe,,,,
region,EUR,Europe,,,,
region,FRA,France,(?-i:FRA|FRE),,,
region,GER,Germany,(?-i:GER),,,
region,INT,International,(?-i:INT),,,
region,JPN,Japan,jpn|(?-i:JAP|JP),,,
region,KOR,South Korea,(?-i:KOR),,,
region,NOR,Norway,(?-i:NOR),,,
region,POL,Poland,(?-i:POL),,,
region,USA,United States,(?-i:US|USA),,,
resolution,PN.Selector,PAL/NTSC Selector,p(?:al)?[\\-\\_\\. ]?n(?:tsc)?[\\-\\_\\. ]selector,,game,1
resolution,DCI4K,DCI 4k,dci[\\-\\_\\. ]?4k|4096x2160,,,
resolution,DCI2K,DCI 2k,dci[\\-\\_\\. ]?2k|2048x1080,,,
resolution,4320p,UltraHD 8K (4320p),4320p|7680x4320,,,
resolution,3240p,6k (3240p),3240p|6k|5760x3240,,,
resolution,2880p,5k (2880p),2880p|5k|5120x2880,,,
resolution,2160p,UltraHD 4K (2160p),2160p|3840x2160|uhd|ultra[\\-\\_\\. ]?hd|4k,,,
resolution,1800p,QHD+ (1800p),1800p|3200x1800,,,
resolution,1440p,QHD (1440p),1440p|2560x1440,,,
resolution,1080p,FullHD (1080p),1080[ip]|1920x1080,,,
resolution,900p,HD+ (900p),900[ip]|1600x900,,,
resolution,720p,HD (720p),720[ip]|1280x720,,,
resolution,576p,PAL (576p),576[ip]|720x576|pal,,,
resolution,540p,qHD (540p),540[ip]|960x540,,,
resolution,480p,NTSC (480p),480[ip]|720x480|848x480|854x480|ntsc,,,
resolution,360p,nHD (360p),360[ip]|640x360,,,
resolution,$1p,Other ($1p),([123]\\d{3})p,,,
size,BD50,BD (50GB),bd[\\-\\_\\. ]?50,,movie,
size,BD25,BD (25GB),bd[\\-\\_\\. ]?25,,movie,
size,BD9,BD (9GB),bd[\\-\\_\\. ]?9,,movie,
size,BD5,BD (5GB),bd[\\-\\_\\. ]?5,,movie,
size,BDRW,BD (RW),bd[\\-\\_\\. ]?rw,,movie,
size,BDR,BD (R),bd[\\-\\_\\. ]?r,,movie,
size,CDRW,CD (RW),cd[\\-\\_\\. ]?rw,,music,
size,CDR,CD (R),cd[\\-\\_\\. ]?r,,music,
size,DVD9,DVD (9GB),dvd[\\-\\_\\. ]?9,,movie,
size,DVD5,DVD (5GB),dvd[\\-\\_\\. ]?5,,movie,
size,DVDRW,DVD (RW),dvd[\\-\\_\\. ]?rw,,movie,
size,DVDR,DVD (R),dvd[\\-\\_\\. ]?r,,movie,
size,FULLDVD,DVD (full),,,game,1
size,MCD,CD (music),m[\\-\\_\\. ]?cd,,music,1
size,MDVD9,DVD (9GB music),m[\\-\\_\\. ]?dvd[\\-\\_\\. ]?9,,music,1
size,MDVD5,DVD (5GB music),m[\\-\\_\\. ]?dvd[\\-\\_\\. ]?5,,music,1
size,MDVDRW,DVD (RW music),m[\\-\\_\\. ]?dvd(?:[\\-\\_\\. ]?rw),,music,1
size,MDVDR,DVD (R music),m[\\-\\_\\. ]?dvd(?:[\\-\\_\\. ]?r),,music,1
size,MDVD,DVD (music),m[\\-\\_\\. ]?dvd,,music,1
size,512MS,MemoryStick (512mb),,,game,1
size,$1$2,$1 $2,(\\d+(?:\\.\\d+)?)?[\\-\\_\\. ]?([kmgt]i?b),,movie,
source,AHDTV,High-Definition TV (analog),,,movie,
source,AUDiOBOOK,Audiobook,a(?:udio[\\-\\_\\. ]?)?books?,,audiobook,1
source,BDRiP,BluRay (rip),b[dr]?[\\-\\_\\. ]?rip,,movie,
source,BDSCR,BluRay (screener),b[dr][\\-\\_\\. ]?scr(?:eener)?,,movie,
source,BluRay3D,,blu[\\-\\_\\. ]?ray[\\-\\_\\. ]?3d|bd3d,,movie,
source,BluRayRiP,BluRay (rip),,,movie,
source,BluRay,,blu[\\-\\_\\. ]?ray|bd,,movie,
source,BRDRip,BluRay Disc (rip),,,movie,
source,CABLE,Radio (cable),(?-i:CABLE),,music,1
source,CAMRiP,CAM (rip),cam[\\-\\_\\. ]?rip,,movie,
source,CAM,,(?-i:CAM),,movie,
source,CDA,Audio CD,,,music,1
source,CDEP,Extended Play (CD),cdep|epcd,,music,1
source,CDLP,Limited Play (CD),,,music,1
source,CDM,Compact Disc Maxi Single,,,music,1
source,CDREP,CD (reproduced),,,music,1
source,CDRiP,Compact Disc (rip),cd[\\-\\_\\. ]?rip,,music,1
source,CDSP,Standard Play (CD),,,music,1
source,CDS,Compact Disc Single,cds|cd[\\-\\_\\. ]?single,,music,
source,CD,Compact Disc,cd[\\-\\_\\. ]?(?:album)?,,music,
source,CloneCD,Clone (CD),clone[\\-\\_\\. ]?cd,,game,1
source,CloneDVD,Clone (DVD),clone[\\-\\_\\. ]?dvd,,game,1
source,COMiC,Comic,(?:classic[\\-\\_\\. ])?comics?,,comic,1
source,CVD,China Video Disc,,,movie,
source,DAT,Datacable,(?-i:DAT),,music,1
source,DCPRiP,Digital Cinema Package (rip),dcp[\\-\\_\\. ]?rip,,movie,
source,DCP,Digital Cinema Package,,,movie,
source,DDCRiP,Digital Distribution Copy (rip),ddc[\\-\\_\\. ]?rip,,music,
source,DDC,Digital Distribution Copy,,,music,
source,Digipak,Digipak CD,,,music,1
source,DSRiP,Digital Satellite (rip),ds[\\-\\_\\. ]?rip|dsr,,,
source,DS,Digital Satellite,,,,
source,DTheater,,,,movie,
source,DTHRiP,Satellite (DTH rip),dth[\\-\\_\\. ]?rip,,,
source,DTH,Satellite (DTH),,,,
source,DTSD,DTS (dual language),,,,
source,3DTV,,,,movie,
source,DTVRiP,Digital TV (rip),dtv[\\-\\_\\. ]?rip,,,
source,DTV,Digital TV,,,,
source,DVBC,Digital Video Broadcasting (cable),dvb[\\-\\_\\. ]?c,,music,
source,DVBRiP,Digital Video Broadcasting (rip),dvb[\\-\\_\\. ]?rip,,,
source,DVBS,Digital Video Broadcasting (satellite),dvb[\\-\\_\\. ]?s,,music,
source,DVBT,Digital Video Broadcasting (terrestial),dvb[\\-\\_\\. ]?t,,music,
source,DVB,Digital Video Brodacasting,,,music,
source,DVDA,Audio DVD,,,music,1
source,DVDRiP,Digital Video Disc (rip),dvd[\\-\\_\\. ]?rip,,movie,
source,DVDSCRRiP,Digital Video Disc (screener rip),(?:dvd[\\-\\_\\. ]?)?scr(?:eener)?_rip,,movie,
source,DVDSCR,Digital Video Disc (screener),(?:dvd[\\-\\_\\. ]?)?scr(?:eener)?,,movie,1
source,DVDS,Digital Video Disc (single),dvds(?:ingle)?,,music,1
source,DVD,Digital Video Disc,dvd,,movie,
source,DVTV,Digital Versatile Television,,,,
source,eBook,,ebooks?,,book,
source,EP,Extended Play,(?-i:EP),,music,1
source,FESTiVAL,Festival,(?-i:F[eE]ST[iI]V[aA]L),,movie,
source,FM,,(?-i:FM),,music,1
source,HDCAM,CAM (HD),hd[\\-\\._ ]?cam,,movie,
source,HDDVDRiP,High-Definition Digital Video Disc (rip),hd[\\-\\_\\. ]?dvd[\\-\\_\\. ]?rip,,movie,
source,HDDVD,High-Definition Digital Video Disc,hd[\\-\\_\\. ]?dvd,,movie,
source,HDRiP,High-Definition TV (rip),hd(?:tv)?[\\-\\_\\. ]?rip,,movie,
source,HDTC,Telecine (HD),hd[\\-\\_\\. ]?tc,,movie,
source,HDTS,Telesync (HD),hd[\\-\\_\\. ]?ts,,movie,
source,HDTV,High-Definition TV,,,,
source,HFR,High Frame Rate,,,movie,
source,IVTC,Inverse Telecine,,,music,
source,LASERDiSC,LaserDisc,,,movie,
source,LP,Limited Play,(?-i:LP),,music,1
source,MAGAZiNE,Magazine,(?-i:MAGAZ[iI]NE),,magazine,1
source,MBluRay,Music BluRay,m(?:usic)?[\\-\\_\\. ]?blu[\\-\\_\\. ]?ray|mbd,,music,1
source,35mm,Film (35mm),,,movie,1
source,16mm,Film (16mm),,,movie,1
source,PDTV,Pure Digital TV,,,,
source,PDVD,Digital Video Disc (pirated),,,movie,1
source,PS2CD,PlayStation 2 (CD),,,game,1
source,PS2DVD,PlayStation 2 (DVD),,,game,1
source,PSXPSP,PlayStation 1 to PlayStation Portable Backup,,,game,1
source,RADIO,Radio,(?-i:R[aA]D[iI][oO]),,music,1
source,SATRiP,Satellite (rip),sat[\\-\\_\\. ]?rip,,,
source,SAT,Satellite Radio,(?-i:SAT),,music,
source,SBD,Soundboard,(?-i:SBD|DAB),,music,1
source,SCAN,Comic (scan),(?-i:SCAN),,comic,1
source,SCD,Sample CD,,,music,1
source,SDTV,TV (SD),,,,
source,SFCloneCD,Clone (StarForce CD),sf[\\-\\_\\. ]?clone[\\-\\_\\. ]?cd,,game,1
source,SFCloneDVD,Clone (StarForce DVD),sf[\\-\\_\\. ]?clone[\\-\\_\\. ]?dvd,,game,1
source,SFClone,Clone (StarForce),sf[\\-\\_\\. ]?clone,,game,1
source,SINGLE,Single,(?-i:S[iI]NGLE|SI),,music,1
source,SP,Standard Play,(?-i:SP),,music,1
source,STREAM,Stream,(?-i:STREAM),,music,1
source,SVCDRiP,Super Video CD (rip),svcd[\\-\\_\\. ]?rip,,music,
source,SVCD,Super Video CD,,,music,
source,TAPE,Tape,(?-i:TAPE),,music,1
source,TC,Telecine,telecine|tc,,movie,
source,TS,Telesync,telesync|ts,,movie,
source,TVHSRiP,TV HS (rip),tvhs[\\-\\_\\. ]?rip,,,
source,TVRiP,TV (rip),tv[\\-\\_\\. ]?rip,,,
source,UHD.BDRiP,Ultra High-Definiton BluRay (rip),uhd[\\-\\_\\. ]?(?:bd)?rip,,movie,
source,UHD.WEB-DL,Ultra High-Definiton Web (dl),uhd[\\-\\_\\. ]?web[\\-\\_\\. ]?dl,,movie,
source,UHD.BluRay,Ultra High-Definiton BluRay,uhd(?:[\\-\\_\\. ]?(?:blu[\\-\\_\\. ]?ray|bd))?,,movie,
source,UHDTV,Ultra High-Definition TV,,,,
source,UMDMOVIE,Universal Media Disc Movie,,,,
source,UMDRiP,Universal Media Disc (rip),umd[\\-\\_\\. ]?rip,,game,1
source,UMD,Universal Media Disc,,,game,1
source,VCDRiP,Video CD (rip),vcd[\\-\\_\\. ]?rip,,movie,
source,VCD,Video CD,,,movie,
source,VHSRiP,VHS (rip),vhs[\\-\\_\\. ]?rip,,movie,
source,VHS,,,,movie,
source,ViNYLRiP,Vinyl (rip),,,music,1
source,ViNYL,Vinyl,vinyl|vl,,music,1
source,VLS,Vinyl (single),vls,,music,1
source,VODRiP,Video-on-Demand (rip),vod[\\-\\_\\. ]?rip,,movie,
source,VOD,Video-on-Demand,,,movie,
source,WEB-DL,Web (DL),web[\\-\\_\\. ]?dl,,movie,
source,WEB-HD,Web (HD),web[\\-\\_\\. ]?hd,,movie,
source,WEBFLAC,Web (FLAC),,,music,1
source,WebHDRiP,Web (HD rip),,,movie,
source,WEBRiP,Web (rip),web[\\-\\_\\. ]?rip,,movie,
source,WEBSCR,Web (screener),web[\\-\\_\\. ]?scr(?:eener)?,,movie,1
source,WebUHD,Web (UHD),,,movie,
source,WEB,Web,,,,
source,Whitelabel,Whitelabel Promo,whitelabel|wlp,,music,1
source,WORKPRiNT,Workprint,workprint|wp,,movie,1
source,XBOXDVD,Xbox (DVD),,,game,1
source,$1INCH.ViNYL,Vinyl ($i inch),(\\d\\d?)[\\-\\_\\. ]?inch(?:[\\-\\_\\. ]?vinyl)?,,music,1
`;

// ----------------------------------------------------------------------
// 2. Enums and Data Classes (Exported)
// ----------------------------------------------------------------------

/** @enum {number} */
const TagType = {
    WHITESPACE: 0, DELIM: 1, TEXT: 2, PLATFORM: 3, ARCH: 4,
    SOURCE: 5, RESOLUTION: 6, COLLECTION: 7, DATE: 8, SERIES: 9,
    VERSION: 10, DISC: 11, CODEC: 12, HDR: 13, AUDIO: 14,
    CHANNELS: 15, OTHER: 16, CUT: 17, EDITION: 18, LANGUAGE: 19,
    SIZE: 20, REGION: 21, CONTAINER: 22, GENRE: 23, ID: 24,
    GROUP: 25, META: 26, EXT: 27,
};

/** @enum {string} */
const ReleaseType = {
    UNKNOWN: "unknown", APP: "app", AUDIOBOOK: "audiobook",
    BOOK: "book", COMIC: "comic", EDUCATION: "education",
    EPISODE: "episode", GAME: "game", MAGAZINE: "magazine",
    MOVIE: "movie", MUSIC: "music", SERIES: "series",
};

/**
 * Parses a release type from a string.
 * @param {string} s The string to parse.
 * @returns {ReleaseType} The corresponding release type enum.
 */
ReleaseType.fromString = function(s) {
    if (!s) return this.UNKNOWN;
    const sUpper = s.toUpperCase();
    for (const key in this) {
        if (key === sUpper) {
            return this[key];
        }
    }
    return this.UNKNOWN;
};

/**
 * Checks if the release type is one of the provided types.
 * @param {ReleaseType} self The release type instance to check.
 * @param {...ReleaseType} types A variable number of types to check against.
 * @returns {boolean} True if the type is in the provided list, false otherwise.
 */
ReleaseType.isIn = function(self, ...types) {
    return types.includes(self);
}

/**
 * Describes a single entry from the tag info database (e.g., taginfo.csv).
 * It holds the canonical tag, its regex, title, and other metadata.
 */
class TagInfo {
    /**
     * Describes tag information.
     * @param {string} tag The canonical tag string (e.g., 'BDRip').
     * @param {string} title The display title for the tag (e.g., 'BluRay (rip)').
     * @param {string} regexp The regex pattern used to match this tag.
     * @param {string} other An alternative or related tag string.
     * @param {ReleaseType} typ The primary release type this tag is associated with.
     * @param {boolean} excl Whether this tag is exclusive to its release type.
     */
    constructor(tag, title, regexp, other, typ, excl) {
        this.tag = tag;
        this.title = title;
        this.regexp = regexp;
        this.other = other;
        this.typ = typ;
        this.excl = excl;

        try {
            if (this.regexp === "collector[[\\-\\_\\. ']?s[\\-\\_\\. ]edition") {
                this.regexp = "collector[\\-\\_\\. ]?s[\\-\\_\\. ]edition";
            }

            /** @type {import('re2')} */
            this.rePattern = null;
            const basePattern = this.getRePattern();

            const finalPattern = `^(?:${basePattern})$`;
            this.rePattern = new RE2(finalPattern, 'i');

        } catch (e) {
            const err = new Error(`Tag '${this.tag}' has invalid regexp '${this.regexp}': ${e.message}`);
            err.cause = e;
            throw err;
        }
    }

    /**
     * Returns the tag info regexp string.
     * @returns {string} The raw regular expression string for the tag.
     */
    getRePattern() {
        if (this.regexp && this.regexp.length > 0) return this.regexp;	    
        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escapeRegex(this.tag);
    }

    /**
     * Matches the tag info to a given string.
     * @param {string} s The string to match against the tag's regex.
     * @returns {boolean} True if the string matches, false otherwise.
     */
    match(s) {
        return this.rePattern.test(s);
    }
}

/**
 * Represents a single parsed token (a "tag") from a release string.
 * It contains the tag's type, its original text, and any captured values from the regex match.
 */
class Tag {
    /**
     * Represents a parsed tag from a release string.
     * @param {TagType} typ The type of the tag.
     * @param {string[]} v An array of strings, where `v[0]` is the original matched text and subsequent elements are captured groups.
     * @param {FindFunc | null} findFunc A function to find associated metadata (TagInfo) for this tag.
     * @param {TagType} prevTyp The previous type of the tag, used for reverting changes.
     * @param {FindFunc | null} prevFindFunc The previous find function.
     */
    constructor(typ, v, findFunc, prevTyp, prevFindFunc) {
        this.typ = typ;
        this.v = v;
        this.findFunc = findFunc;
        this.prevTyp = prevTyp;
        this.prevFindFunc = prevFindFunc;
    }

    /**
     * Creates a new tag.
     * @param {TagType} typ The type of the tag.
     * @param {FindFunc | null} findFunc The function to find associated tag info.
     * @param {...(string|Buffer|null|undefined|number)} byteVals The values for the tag. The first is the original matched string, subsequent values are captures.
     * @returns {Tag} The newly created tag.
     * @throws {Error} If less than two values are provided.
     */
    static new(typ, findFunc, ...byteVals) {
        if (byteVals.length < 2) {
            throw new Error("Must provide at least 2 values to new_tag");
        }

        const strVals = [];
        for (const v of byteVals) {
            if (Buffer.isBuffer(v)) {
                strVals.push(v.toString('utf-8', 'replace'));		    
            } else {
                strVals.push(v != null ? String(v) : "");
            }
        }

        return new Tag(typ, strVals, findFunc, typ, findFunc);
    }

    /**
     * Returns a copy of the tag as a tag of the specified type.
     * @param {TagType} newTyp The new tag type.
     * @param {FindFunc | null} newFindFunc The new find function.
     * @returns {Tag} A new tag with the specified type.
     */
    as(newTyp, newFindFunc) {
        return new Tag(
            newTyp,
            this.v,
            newFindFunc,
            this.typ,
            this.findFunc
        );
    }

    /**
     * Returns a copy of the tag as the tag's previous type.
     * @returns {Tag} A new tag with the previous type and find function.
     */
    revert() {
         return new Tag(
            this.prevTyp,
            this.v,
            this.prevFindFunc,
            this.prevTyp,
            this.prevFindFunc
        );
    }

    /**
     * Checks if the tag is of one of the specified types.
     * @param {...TagType} types A variable number of tag types to check against.
     * @returns {boolean} True if the tag's type matches any of the provided types.
     */
    is(...types) {
        return types.includes(this.typ);
    }

    /**
     * Checks if the tag's previous type was one of the specified types.
     * @param {...TagType} types A variable number of tag types to check against.
     * @returns {boolean} True if the tag's previous type matches any of the provided types.
     */
    was(...types) {
        return types.includes(this.prevTyp);
    }
}

/**
 * Retrieves the tag's associated tag info.
 * @returns {TagInfo | null} The associated TagInfo object, or null if not found.
 */
Tag.prototype.info = function() {
    if (this.findFunc) {
        return this.findFunc(this.normalize());
    }
    return null;
};

/**
 * Checks if the tag represents a single episode (e.g., "E01" without a season).
 * @returns {boolean} True if the tag is a series tag for a single episode without a season.
 */
Tag.prototype.singleEp = function() {
    if (this.typ === TagType.SERIES) {
        const [s, e] = this.series();
        return s === 0 && e !== 0 && this.v[1] === "" && this.v[0] === this.v[2];
    }
    return false;
};

/**
 * Returns the associated release type from the tag's info.
 * @returns {ReleaseType} The release type (e.g., Movie, Music) from the tag's metadata.
 */
Tag.prototype.infoType = function() {
    const info = this.info();
    return info ? info.typ : ReleaseType.UNKNOWN;
};

/**
 * Returns the exclusivity flag from the tag's info.
 * @returns {boolean} True if the tag is exclusive to its release type.
 */
Tag.prototype.infoExcl = function() {
    const info = this.info();
    return info ? info.excl : false;
};

/**
 * Retrieves the tag's title from its info, substituting any placeholders.
 * @returns {string} The formatted title string from the tag's metadata.
 */
Tag.prototype.infoTitle = function() {
    const info = this.info();
    if (info) {
        let s = info.title;
        this.v.slice(1).forEach((val, i) => {
            s = s.replace(`$${i + 1}`, val);
        });
        return s;
    }
    return "";
};


/**
 * Normalizes a string by looking up its info and replacing placeholders.
 * @param {string} s The string to normalize.
 * @param {...string} v Values to substitute into placeholders like $1, $2.
 * @returns {string} The normalized string.
 * @private
 */
Tag.prototype._normalizeWithFunc = function(s, ...v) {
    if (this.findFunc) {
        const info = this.findFunc(s);
        if (info) {
            s = info.tag;
        }
    }
    for (let i = 0; i < v.length; i++) {
        s = s.replace(`$${i + 1}`, v[i]);
    }
    return s;
};

/**
 * Returns the normalized string for the tag based on its type.
 * @returns {string} The normalized string representation of the tag.
 */
Tag.prototype.normalize = function() {
    switch (this.typ) {
        case TagType.WHITESPACE: return this.whitespace();
        case TagType.DELIM: return this.delim();
        case TagType.TEXT: return this.text();
        case TagType.PLATFORM: return this.platform();
        case TagType.ARCH: return this.arch();
        case TagType.SOURCE: return this.source();
        case TagType.RESOLUTION: return this.resolution();
        case TagType.COLLECTION: return this.collection();
        case TagType.DATE: {
            const [year, month, day] = this.date();
            if (month && day) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
            return String(year);
        }
        case TagType.SERIES: {
            const [series, episode] = this.series();
            if (episode) {
                return `S${String(series).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
            }
            return `S${String(series).padStart(2, '0')}`;
        }
        case TagType.VERSION: return this.version();
        case TagType.DISC: return this.disc();
        case TagType.CODEC: return this.codec();
        case TagType.HDR: return this.hdr();
        case TagType.AUDIO: return this.audio();
        case TagType.CHANNELS: return this.channels();
        case TagType.OTHER: return this.other();
        case TagType.CUT: return this.cut();
        case TagType.EDITION: return this.edition();
        case TagType.LANGUAGE: return this.language();
        case TagType.SIZE: return this.size();
        case TagType.REGION: return this.region();
        case TagType.CONTAINER: return this.container();
        case TagType.GENRE: return this.genre();
        case TagType.ID: return this.id_();
        case TagType.GROUP: return this.group();
        case TagType.META: {
            const [typ, s] = this.meta();
            if (typ === "site" || typ === "sum") return `[${s}]`;
            if (typ === "pass") return `{{${s}}}`;
            if (typ === "req") return "[REQ]";
            return `[[${typ}:${s}]]`;
        }
        case TagType.EXT: return this.ext();
        default: return "";
    }
};

/**
 * Formats the tag into a string based on the verb.
 *
 * Format Options:
 * - `q`: All values including captured values, quoted (e.g., `["2009", "2009", "", ""]`)
 * - `o`: Original matched string (e.g., `2009`)
 * - `v`: Tag type followed by colon and quoted capture values (e.g., `Date:["2009", "", ""]`)
 * - `e`: Tag type and normalized value in angle brackets (e.g., `<Date:2009>`)
 * - `s`, `r`: Normalized value (e.g., `2009`)
 * @param {string} verb The formatting verb.
 * @returns {string} The formatted string.
 */
Tag.prototype.format = function(verb) {
    switch (verb) {
        case 'q': return `"${inspect(this.v)}"`;
        case 'o': return this.v[0];
        case 'v': return `${Object.keys(TagType).find(k => TagType[k] === this.typ)}:${inspect(this.v.slice(1))}`;
        case 'e': {
            const s = this.normalize();
            return `<${Object.keys(TagType).find(k => TagType[k] === this.typ)}:${s}>`;
        }
        case 's':
        case 'r':
            return this.normalize();
    }
    return "";
};

/**
 * Returns the original matched string for the tag.
 * @returns {string} The original text that this tag was parsed from.
 */
Tag.prototype.toString = function() {
    return this.format('o');
};

/**
 * Determines if a string matches the tag.
 * @param {string} s The string to match.
 * @param {string} verb The formatting verb to use for comparison ('o', 's', 'r', etc.).
 * @param {...TagType} types Optional types to filter by; if provided, the tag must be one of these types.
 * @returns {boolean} True if the string matches the tag.
 */
Tag.prototype.match = function(s, verb, ...types) {
    if (types.length > 0 && !types.includes(this.typ)) {
        return false;
    }

    let v = this.format(verb);
    if (!s) {
        return true;
    }

    if (this.findFunc && verb === 's') {
        const info = this.findFunc(s);
        if (info) {
            s = info.tag;
        }
    }

    if (verb === 'r') {
        return new RegExp(s).test(v);
    }
    return s === v;
};


/** Normalizes the whitespace value. */
Tag.prototype.whitespace = function() { return this.v[1]; }
/** Normalizes the delimiter value. */
Tag.prototype.delim = function() { return this.v[1]; }
/** Normalizes the text value. */
Tag.prototype.text = function() {
    if ([TagType.DATE, TagType.SERIES].includes(this.prevTyp)) return this.v[0];
    if (this.prevTyp === TagType.CHANNELS) return this.channels();
    return this.v[1];
}
/**
 * Normalizes the text value and replaces occurrences of a substring.
 * @param {string} old The substring to be replaced.
 * @param {string} newStr The string to replace with.
 * @param {number} [n=-1] The maximum number of replacements. If -1, all occurrences are replaced.
 * @returns {string} The modified text.
 */
Tag.prototype.textReplace = function(old, newStr, n = -1) {
    let s = this.text();
    if (this.prevTyp === TagType.CHANNELS) return s;
    if (n > -1) {
        let count = 0;
        const re = new RegExp(old, 'g');
        return s.replace(re, (match) => ++count <= n ? newStr : match);
    }
    return s.replaceAll(old, newStr);
}

/** Normalizes the platform value. */
Tag.prototype.platform = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the arch value. */
Tag.prototype.arch = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the source value. */
Tag.prototype.source = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the resolution value. */
Tag.prototype.resolution = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the collection value. */
Tag.prototype.collection = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/**
 * Normalizes the date value.
 * @returns {[number, number, number]} A tuple containing year, month, and day.
 */
Tag.prototype.date = function() {
    const year = parseInt(this.v[1], 10) || 0;
    const month = parseInt(this.v[2], 10) || 0;
    const day = parseInt(this.v[3], 10) || 0;
    return [year, month, day];
};
/**
 * Normalizes the series value.
 * @returns {[number, number]} A tuple containing series and episode number.
 */
Tag.prototype.series = function() {
    const series = parseInt(this.v[1], 10) || 0;
    const episode = parseInt(this.v[2], 10) || 0;
    return [series, episode];
};
/**
 * Normalizes and returns all episode numbers from the tag.
 * @returns {number[]} An array of episode numbers.
 */
Tag.prototype.episodes = function() {
    return this.v.slice(2).filter(b => b).map(b => parseInt(b, 10));
};
/** Normalizes the version value. */
Tag.prototype.version = function() { return this.v[1]; };
/**
 * Normalizes the disc value.
 * @returns {string} The normalized disc string (e.g., "CD1", "2x", "D01").
 */
Tag.prototype.disc = function() {
    const disc = parseInt(this.v[2], 10) || 0;
    const typ = this.v[1];
    if (typ === "CD" || typ === "DVD") return `${typ}${disc}`;
    if (typ === "S") return `${disc}DiSCS`;
    if (typ === "X") return `${disc}x`;
    return `D${String(disc).padStart(2, '0')}`;
};
/** Normalizes a codec value. */
Tag.prototype.codec = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes a HDR value. */
Tag.prototype.hdr = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes an audio value. */
Tag.prototype.audio = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/**
 * Normalizes a channels value (e.g., "5.1").
 * @returns {string} The normalized channels string.
 */
Tag.prototype.channels = function() {
    const s = (this._normalizeWithFunc(this.v[1], this.v[1]).match(/\d/g) || []).join('');
    if (!s) return "";
    return `${s[0]}.${s.slice(1)}`;
};
/** Normalizes the other value. */
Tag.prototype.other = function() {
    const s = this._normalizeWithFunc(this.v[1], ...this.v.slice(2));
    if (s.toUpperCase() === "19XX" || s.toUpperCase() === "20XX") {
        return s.toUpperCase();
    }
    return s;
};
/** Normalizes the cut value. */
Tag.prototype.cut = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the edition value. */
Tag.prototype.edition = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the language value. */
Tag.prototype.language = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the size value. */
Tag.prototype.size = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)).toUpperCase().replace("I", "i"); };
/** Normalizes the region value. */
Tag.prototype.region = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the container value. */
Tag.prototype.container = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the genre value. */
Tag.prototype.genre = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the ID value. */
Tag.prototype.id_ = function() { return this._normalizeWithFunc(this.v[1], ...this.v.slice(2)); };
/** Normalizes the group value. */
Tag.prototype.group = function() { return this.v[1]; };
/**
 * Normalizes a file meta value.
 * @returns {[string, string]} A tuple containing the meta key and value.
 */
Tag.prototype.meta = function() { return [this.v[1], this.v[2]]; };
/** Normalizes a file extension value. */
Tag.prototype.ext = function() { return this.v[1].toLowerCase(); };

/**
 * Represents the final, structured information parsed from a release string.
 */
class Release {
    /**
     * Represents parsed release information.
     * @param {Tag[]} [tags=[]] The initial array of tags.
     * @param {number} [end=0] The index separating start tags from end tags.
     */
    constructor(tags = [], end = 0) {
        this.type = ReleaseType.UNKNOWN;
        this.artist = "";
        this.title = "";
        this.subtitle = "";
        this.alt = "";
        this.platform = "";
        this.arch = "";
        this.source = "";
        this.resolution = "";
        this.collection = "";
        this.year = 0;
        this.month = 0;
        this.day = 0;
        this.series = 0;
        this.episode = 0;
        this.version = "";
        this.disc = "";
        /** @type {string[]} */
        this.codec = [];
        /** @type {string[]} */
        this.hdr = [];
        /** @type {string[]} */
        this.audio = [];
        this.channels = "";
        /** @type {string[]} */
        this.other = [];
        /** @type {string[]} */
        this.cut = [];
        /** @type {string[]} */
        this.edition = [];
        /** @type {string[]} */
        this.language = [];
        this.size = "";
        this.region = "";
        this.container = "";
        this.genre = "";
        this.id = "";
        this.group = "";
        /** @type {string[]} */
        this.meta = [];
        this.site = "";
        this.sum = "";
        this.pass_ = "";
        this.req = false;
        this.ext = "";

        // Internal fields for parsing and building
        /** @type {Tag[]} */
        this.tags = tags;
        /** @type {number[]} */
        this.dates = [];
        /** @type {number[]} */
        this.unused = [];
        /** @type {number} */
        this.end = end; // Marks the end of start tags, start of end tags
    }

    /**
     * Returns the original release string by joining all original tag text.
     * @returns {string} The reconstructed original release string.
     */
    toString() {
        return this.tags.map(tag => tag.format('o')).join('');
    }

    /**
     * Custom inspector for Node.js `util.inspect`.
     * @returns {string} A simplified string representation for logging.
     */
    [inspect.custom]() {
        return `Release(type=${this.type}, title='${this.title}', artist='${this.artist}')`;
    }

    /**
     * Returns all parsed tags for the release.
     * @returns {Tag[]} The array of tags.
     */
    getTags() {
        return this.tags;
    }

    /**
     * Returns text tags that were not used in titles.
     * @returns {Tag[]} An array of unused text tags.
     */
    getUnused() {
        return this.unused.map(i => this.tags[i]);
    }

    /**
     * Returns date tags that were not used as the primary release date.
     * @returns {Tag[]} An array of unused date tags.
     */
    getDates() {
        return this.dates.map(i => this.tags[i]);
    }

    /**
     * Returns all detected series and episode combinations.
     * This can include ranges (e.g., S01E01-E03 becomes [[1,1], [1,2], [1,3]]).
     * @returns {[number, number][]} An array of [series, episode] pairs, sorted by series then episode.
     */
    seriesEpisodes() {
        /** @type {[number, number][]} */
        let v = [];
        let lastSeriesIdx = -1;

        for (let i = 0; i < this.tags.length; i++) {
            const tag = this.tags[i];
            if (!tag.is(TagType.SERIES)) {
                continue;
            }

            const [series, firstEpisode] = tag.series();
            for (const episode of tag.episodes()) {
                let s = series;
                if (s === 0 && lastSeriesIdx !== -1) {
                    const [lastSeries, lastEp] = this.tags[lastSeriesIdx].series();
                    s = lastSeries;

                    if (i > 0 && this.tags[i - 1].is(TagType.DELIM) && this.tags[i - 1].toString() === "-") {
                        const [, prevEp] = this.tags[lastSeriesIdx].series();
                        for (let j = prevEp + 1; j < episode; j++) {
                            v.push([s, j]);
                        }
                    }
                }
                v.push([s, episode]);
            }
            if (series !== 0) {
                lastSeriesIdx = i;
            }
        }

        v.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        return v;
    }
}

// ----------------------------------------------------------------------
// 3. Internal Helper Functions (Internal)
// ----------------------------------------------------------------------

/**
 * This helper function defines hardcoded groups with special characters (like hyphens)
 * that the standard group lexer would otherwise split incorrectly.
 * @returns {Object<string, TagInfo[]>} A map containing a 'group' key with an array of hardcoded group TagInfos.
 * @private
 */
function _getHardcodedGroups() {
    const groups = [];
    const group_data = [
        ["CODEX", "game"],
        ["DARKSiDERS", "game"],
        ["D-Z0N3", "movie"],
        ["MrSeeN-SiMPLE", ""],
    ];
    for (const [tag, typ] of group_data) {
        const releaseType = typ ? ReleaseType.fromString(typ) : ReleaseType.UNKNOWN;
        const info = new TagInfo(tag, tag, "", "", releaseType, false);
        groups.push(info);
    }
    return {"group": groups};
}

/**
 * Loads and parses tag information from a CSV string.
 * @param {string} csvData The string content of the taginfo CSV file.
 * @returns {Object<string, TagInfo[]>} A map where keys are tag types (e.g., 'source', 'codec') and values are arrays of TagInfo objects.
 * @private
 */
function _loadTagInfoFromCsv(csvData) {
    /** @type {Object<string, TagInfo[]>} */
    const infos = {};
    const lines = csvData.trim().split('\n');
    const header = lines.shift().split(',');

    if (header.length !== 7) {
        throw new Error(`Expected 7 columns in taginfo csv, got ${header.length}`);
    }

    const exists = {};

    for (let i = 0; i < lines.length; i++) {
        const row = lines[i].split(',');	    
        if (row.length !== 7) continue;

        let [type, tag, title, regexp, other, releaseTypeStr, exclStr] = row;
        
        const clean = s => s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
        type = clean(type);
        tag = clean(tag);
        title = clean(title);
        regexp = clean(regexp);
        other = clean(other);
        releaseTypeStr = clean(releaseTypeStr);
        exclStr = clean(exclStr);


        if (!infos[type]) {
            infos[type] = [];
            exists[type] = {};
        }

        if (exists[type][tag]) {
            throw new Error(`Line ${i + 2}: type '${type}' with tag '${tag}' previously defined on line ${exists[type][tag] + 2}`);
        }

        if (!tag) {
            throw new Error(`Line ${i + 2}: must define tag`);
        }

        const releaseTypeEnum = ReleaseType.fromString(releaseTypeStr);
        if (releaseTypeStr && releaseTypeEnum === ReleaseType.UNKNOWN) {
            throw new Error(`Line ${i+2}: invalid release type '${releaseTypeStr}'`);
        }

        const info = new TagInfo(
            tag,
            title || tag,
            regexp,
            other,
            releaseTypeEnum,
            exclStr === "1"
        );
        infos[type].push(info);
        exists[type][tag] = i;
    }

    return infos;
}

/**
 * Sorts the tag infos within each type category for optimal matching.
 * The sorting logic is specific to each type to ensure longer, more specific tags are matched before shorter, more general ones.
 * @param {Object<string, TagInfo[]>} infos The map of tag infos to sort in-place.
 * @returns {Object<string, TagInfo[]>} The sorted map of tag infos.
 * @private
 */
function _sortTagInfos(infos) {
    const getNum = (s) => parseInt((s.match(/\d+/) || ['0'])[0], 10);

    const compareHasDollar = (a, b) => {
        const ac = a.tag.includes('$');
        const bc = b.tag.includes('$');
        if (ac && !bc) return 1;
        if (bc && !ac) return -1;
        if (ac && bc) return a.tag.localeCompare(b.tag);
        return 0;
    };

    const comparePrefix = (a, b) => {
        const a_tag = a.tag.toLowerCase();
        const b_tag = b.tag.toLowerCase();
        if (a_tag === b_tag) return 0;
        if (a_tag.startsWith(b_tag)) return -1;
        if (b_tag.startsWith(a_tag)) return 1;
        return 0;
    };

    for (const type in infos) {
        if (type === "ext") {
            infos[type].sort((a, b) => {
                if (b.tag.endsWith(a.tag)) return 1;
                if (a.tag.endsWith(b.tag)) return -1;
                return a.tag.localeCompare(b.tag);
            });
        } else if (["resolution", "channels"].includes(type)) {
            infos[type].sort((a, b) =>
                compareHasDollar(a, b) ||
                getNum(b.tag) - getNum(a.tag) ||
                a.tag.localeCompare(b.tag)
            );
        } else if (["platform", "codec", "hdr"].includes(type)) {
            infos[type].sort((a, b) =>
                b.tag.length - a.tag.length ||
                a.tag.localeCompare(b.tag)
            );
        } else {
            infos[type].sort((a, b) =>
                compareHasDollar(a, b) ||
                comparePrefix(a, b) ||
                b.tag.length - a.tag.length ||
                a.tag.toLowerCase().localeCompare(b.tag.toLowerCase())
            );
        }
    }
    return infos;
}

/**
 * Returns a function that finds the first matching TagInfo from a list.
 * This is a factory that creates a specialized find function for a given set of TagInfo objects.
 * @param {...TagInfo} infos A variable number of TagInfo objects to search through.
 * @returns {FindFunc} A function that takes a string and returns the first matching TagInfo or null.
 * @private
 */
function _createFindFunc(...infos) {
    return (s) => {
        for (const info of infos) {
            if (info.match(s)) {
                return info;
            }
        }
        return null;
    };
}


const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Joins an array of strings into a single regex alternation pattern (e.g., `(str1|str2|...)`).
 * @param {string[]} strs The strings to join.
 * @param {boolean} [quote=false] If true, each string is escaped to be treated as a literal.
 * @returns {string} The combined regex string.
 * @private
 */
function _reutil_join(strs, quote = false) {
    if (quote) {
        return strs.map(escapeRegex).join('|');
    }
    return strs.join('|');
}

/**
 * Builds a regular expression from an array of strings with various configuration options.
 *
 * Config options:
 * - `i`: ignore case
 * - `^`: add `^` start anchor
 * - `a`: add `\b` start anchor (word boundary)
 * - `q`: quote each string with regex escapes
 * - `b`: add `\b` end anchor (word boundary)
 * - `S`: add `S` end anchor
 * @param {string} config A string containing configuration flags.
 * @param {...string} strs The strings to build the regex from.
 * @returns {string} The final regex string.
 * @private
 */
function _reutil_build(config, ...strs) {
    const parts = [];
    if (config.includes('i')) parts.push('(?i)');
    if (config.includes('^')) parts.push('^');
    if (config.includes('a')) parts.push('\\b');

    parts.push(`(${_reutil_join(strs, config.includes("q"))})`);

    if (config.includes('b')) parts.push('\\b');
    if (config.includes('$')) parts.push('$');

    return parts.join('');
}

/**
 * Builds a regular expression from a list of TagInfo objects.
 * See `_reutil_build` for config options.
 * @param {string} config A string containing configuration flags.
 * @param {...TagInfo} infos The TagInfo objects to get regex patterns from.
 * @returns {string} The final regex string.
 * @private
 */
function _reutil_build_from_taginfo(config, ...infos) {
    const patterns = infos.map(info => info.getRePattern());
    return _reutil_build(config, ...patterns);
}

/**
 * Collapser is a text transformer that cleans and normalizes strings.
 * It can convert various whitespace characters to a single space, remove specified runes,
 * collapse adjacent spaces, and optionally convert to lowercase.
 *
 * Ideally used in a chain between NFD and NFC normalization for handling Unicode correctly.
 *
 * @see https://blog.golang.org/normalization
 * @private
 */
class Collapser {
    /**
     * @param {boolean} lower Whether to convert the string to lowercase.
     * @param {boolean} trim Whether to trim leading/trailing whitespace.
     * @param {string} remove A string of characters to remove.
     * @param {string} space A string of characters to treat as spaces.
     * @param {((r: string, prev: string, next: string) => (number|string)) | null} transformer An optional function to transform individual characters.
     */
    constructor(lower, trim, remove, space, transformer) {
        this.spc = ' ';
        this.lower = lower;
        this.trim = trim;
        this.remove = new Set(remove);
        this.space = new Set(space);
        this.transformer = transformer;
    }

    /**
     * Applies the transform to a string.
     * @param {string} text The input string to transform.
     * @returns {string} The transformed string.
     */
    transform(text) {
        text = text.normalize('NFD');
        if (!text) return "";

        let startIndex = 0;
        if (this.trim) {
            while(startIndex < text.length) {
                const char = text[startIndex];
                if (!this.space.has(char) && !this.remove.has(char)) {
                    break;
                }
                startIndex++;
            }
            if (startIndex === text.length) return "";
        }

        const result = [];
        let prevChar = '';
        const textWithLookahead = text + '\0';

        for (let i = startIndex; i < text.length; i++) {
            let r = textWithLookahead[i];

            if (/\p{M}/u.test(r)) { // Check for non-spacing marks
                continue;
            }

            if (this.space.has(r)) {
                if (prevChar === this.spc) continue;
                r = this.spc;
            } else if (this.remove.has(r)) {
                continue;
            }

            if (this.transformer) {
                const nextChar = textWithLookahead[i + 1];
                const transformed_r = this.transformer(r, prevChar, nextChar);
                if (transformed_r === -1) continue;
                r = /** @type {string} */ (transformed_r);
            }

            if (this.lower) {
                r = r.toLowerCase();
            }

            result.push(r);
            prevChar = r;
        }

        let finalStr = result.join('');
        if (this.trim) {
            finalStr = finalStr.trimEnd();
        }

        return finalStr.normalize('NFC');
    }
}

/**
 * Creates a new text transformer chain that cleans text.
 * It performs Unicode normalization (NFD), removes specified characters and collapses spaces,
 * and then re-composes the string (NFC).
 * @returns {Collapser} A configured Collapser instance for cleaning text.
 * @private
 */
function _newCleaner() {
    return new Collapser(false, true, "'", " \t\r\n\f", null);
}

/**
 * Applies the Clean transform to a string.
 * @param {string} s The input string.
 * @returns {string} The cleaned string.
 */
function mustClean(s) {
    return _newCleaner().transform(s);
}

/**
 * Transformer function for the normalizer.
 * @private
 */
function _normalizerTransformer(r, prev, next) {
    if (r === '-' && /\s/.test(prev)) {
        return -1;
    }
    const isAlpha = (c) => /[a-zA-Z]/.test(c);
    if (r === '$' && (isAlpha(prev) || isAlpha(next))) {
        return 'S';
    }
    if (r === '£' && (isAlpha(prev) | isAlpha(next))) {
        return 'L';
    }
    if (r === '$' || r === '£') {
        return -1;
    }
    return r;
}

/**
 * Creates a new text transformer chain that normalizes text to a lower-case,
 * clean form, suitable for title matching. It's more aggressive than the cleaner.
 * @retus {Collapser} A coigured Collapser instance for normalizing text.
 * @private
 */
function _newNormalizer() {
    return new Collapser(
        true, true,
        "`':;~!@#%^*=+()[]{}<>/?|\\\",",
        " \t\r\n\f._",
        _normalizerTransformer
    );
}

/**
 * Applies the Normalize transform to a string, returning a lower-cased,
 * clean form of s useful for matching titles.
 * @param {string} s The input string.
 * @returns {string} The normalized string.
 */
function mustNormalize(s) {
    return _newNormalizer().transform(s);
}

// ----------------------------------------------------------------------
// 4. Lexer Implementation (Internal)
// ---------------------------------------------------------------------

/** @typedef {[Tag[], Tag[], number, number, boolean]} LexResult The result of a lexer function: [start_tags, end_tags, new_start_index, new_end_index, was_match]. */
/** @typedef {(parser: TagParser, src: string, buf: string, start: Tag[], end: Tag[], i: number, n: number) => LexResult} LexFunc The signature for a lexer function. */

/**
 * The interface for all lexers.
 */
class Lexer {
    /**
     * @param {boolean} [notFirst=false] If true, this lexer will not run on the first token of a release name.
     * @param {boolean} [once=false] If true, this lexer runs only once at the beginning of parsing.
     */
    constructor(notFirst = false, once = false) {
        this.notFirst = notFirst;
        this.once = once;
        /** @type {LexFunc | null} */
        this.lexFunc = null;
    }

    /**
     * Initializes the lexer with parser-wide information like all tag definitions.
     * @param {TagParser} parser The main tag parser instance.
     * @param {Object<string, TagInfo[]>} infos A map of all tag information.
     * @param {RegExp} delimRe The regex for matching delimiters.
     * @returns {LexFunc} The actual function to be called during parsing.
     */
    initialize(parser, infos, delimRe) {
        throw new Error("Lexer subclasses must implement initialize");
    }
}

/**
 * A concrete lexer implementation.
 */
class TagLexer extends Lexer {
    /**
     * @param {LexFunc} lexFunc The function that implements the lexer's logic.
     * @param {boolean} [once=false] See `Lexer`.
     * @param {boolean} [notFirst=false] See `Lexer`.
     */
     constructor(lexFunc, once = false, notFirst = false) { super(notFirst, once); this._lexFuncImpl = lexFunc; }	

    /**
     * Initializes the TagLexer.
     * @param {TagParser} parser
     * @param {Object<string, TagInfo[]>} infos
     * @param {RegExp} delimRe
     * @returns {LexFunc}
     */
    initialize(parser, infos, delimRe) {
        this.lexFunc = this._lexFuncImpl;	    
        return this.lexFunc;
    }
}

// ---- Lexer Factories ----

/**
 * Creates a tag lexer that matches leading and trailing whitespace.
 * @returns {TagLexer} A lexer for trimming whitespace.
 */
function newTrimWhitespaceLexer() {
    const s = '(\\t|\\n|\\f|\\r| |⭐|\ufe0f)+';
    const s_extended = '(\\\\t|\\n|\\\\f|\\\\r| |âe0f)+';
    const prefix = new RegExp(`^${s}`);
    const suffix = new RegExp(`${s}$`);
    const prefix_extended = new RegExp(`^${s_extended}`);
    const suffix_extended = new RegExp(`${s_extended}$`);

    /** @type {LexFunc} */
    const lex = (parser, src, buf, start, end, i, n) => {
        let m = src.substring(i, n).match(prefix_extended);	    
        if (m) {
            const match_str = m[0];
            start.push(Tag.new(TagType.WHITESPACE, null, match_str, match_str));
          i += match_str.length;
        }

        m = src.substring(i, n).match(prefix);
        if (m) {
            const match_str = m[0];
            start.push(Tag.new(TagType.WHITESPACE, null, match_str, match_str));
            i += match_str.length;
        }

        let sub = src.substring(i, n);
        m = sub.match(suffix_extended);
        if (m) {
            const match_str = m[0];
            end.push(Tag.new(TagType.WHITESPACE, null, match_str, match_str));
            n -= match_str.length;
        }

        sub = src.substring(i, n);
        m = sub.match(suffix);
        if (m) {
            const match_str = m[0];
            end.push(Tag.new(TagType.WHITESPACE, null, match_str, match_str));
            n -= match_str.length;
        }

        return [start, end, i, n, true];
    };
    return new TagLexer(lex, true);
}

/**
 * A lexer for matching dates in various formats.
 * @private
 */
class DateLexer extends Lexer {
    /**
     * @param {...string} strs Regular expression patterns for matching dates.
     */
    constructor(...strs) {
        super();
        this.patterns = strs.map(s => new RE2(s, 'i'));
    }

    /**
     * @inheritdoc
     * @param {TagParser} parser
     * @param {Object<string, TagInfo[]>} infos
     * @param {RegExp} delimRe
     * @returns {LexFunc}
     */
    initialize(parser, infos, delimRe) {
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for dates.
     * @param {TagParser} parser
     * @param {string} src
     * @param {string} buf
     * @param {Tag[]} start
     * @param {Tag[]} end
     * @param {number} i
     * @param {number} n
     * @returns {LexResult}
     */
    _lex(parser, src, buf, start, end, i, n) {	
        for (const pattern of this.patterns) {
            const m = pattern.exec(buf.substring(i, n));
            if (!m) continue;

            const matchStr = src.substring(i, i + m[0].length);

            let year = "", month = "", day = "", isValid = true;		
            const groups = m.groups || {};

            for (const name in groups) {
                const val_str = groups[name];
                if (val_str == null) continue;

                if (name === "2006") {		    
                    year = val_str;
                } else if (name === "YY") {
                    if (val_str.length !== 2) { isValid = false; break; }
                    year = "20" + val_str;
                } else if (name === "01") {
                    if (val_str.length !== 2) { isValid = false; break; }			
                    month = String(parseInt(val_str, 10)).padStart(2, '0');
                } else if (name === "02" || name === "_2") {
                    if (name === '02' && val_str.length !== 2) { isValid = false; break; }
                    if (val_str.length === 0 || val_str.length > 2) { isValid = false; break; }	
                    day = String(parseInt(val_str, 10)).padStart(2, '0');
                } else if (name === "Jan") {
                    if (val_str.length !== 3) { isValid = false; break; }
                    const monthNum = new Date(Date.parse(val_str +" 1, 2012")).getMonth() + 1;
                    if (!isNaN(monthNum)) {
                        month = String(monthNum).padStart(2, '0');			
                    }
                } else if (name === "January") {
                    if (val_str.length <= 3) { isValid = false; break; }
                     const monthNum = new Date(Date.parse(val_str +" 1, 2012")).getMonth() + 1;
                    if (!isNaN(monthNum)) {
                        month = String(monthNum).padStart(2, '0');			
                    }
                }
            }

            if (isValid && (year || month || day)) {
                 try {
                    const y_val = parseInt(year, 10);
                    const m_val = parseInt(month, 10) || 1;
                    const d_val = parseInt(day, 10) || 1;
                    if (y_val > 0) {
                        const d = new Date(y_val, m_val - 1, d_val);
                        if (d.getFullYear() !== y_val || d.getMonth() !== m_val - 1 || d.getDate() !== d_val) {
                             continue;
                        }
                    }
                } catch (e) {
                    continue;
                }
		    
                start.push(Tag.new(TagType.DATE, null, m[0], year, month, day));
                return [start, end, i + m[0].length, n, true];		    
            }
        }
        return [start, end, i, n, false];
    }
}


/**
 * A lexer for matching series, seasons, and episodes.
 * @private
 */
class SeriesLexer extends Lexer {
    /**
     * @param {...string} strs Regular expression patterns for matching series/episodes.
     */
    constructor(...strs) {
        super();
        this.patterns = strs.map(s => new RE2(s, 'i'));
        this.mlt_re = /s(\d?\d)/gi;
        this.mny_re = /[\-\._ ]?e(\d{1,5})/gi;
        this.dsc_re = /^(disc|disk|dvd|d)/i;
        /** @type {FindFunc | null} */
        this.sourcef = null;
    }

    /**
     * @inheritdoc
     * @param {TagParser} parser
     * @param {Object<string, TagInfo[]>} infos
     * @param {RegExp} delimRe
     * @returns {LexFunc}
     */
    initialize(parser, infos, delimRe) {
        this.sourcef = _createFindFunc(...(infos["source"] || []));
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for series/episodes.
     * @param {TagParser} parser
     * @param {string} src
     * @param {string} buf
     * @param {Tag[]} start
     * @param {Tag[]} end
     * @param {number} i
     * @param {number} n
     * @returns {LexResult}
     */
    _lex(parser, src, buf, start, end, i, n) {	
        for (const pattern of this.patterns) {
            const m = pattern.exec(buf.substring(i, n));
            if (!m) continue;

            const s = src.substring(i, i + m[0].length);
            const groups = m.groups || {};
            const { s: series, e: episode, v: version, d: disc, S: multi_season, m: many_eps } = groups;

            if (!(series || episode || version || disc || multi_season || many_eps)) continue;

            const tags_to_add = [];

            if (series || episode) {
                let series_text = s;
                if (version) series_text = series_text.slice(0, -version.length);
                if (disc) series_text = series_text.slice(0, -disc.length);

                const tag_values = [series_text, series || ""];
                if (many_eps) {
                    const episode_numbers = [...many_eps.matchAll(this.mny_re)].map(match => match[1]);
                    tag_values.push(...episode_numbers);
                } else {
                    tag_values.push(episode || "");
                }
                tags_to_add.push(Tag.new(TagType.SERIES, null, ...tag_values));
            }

            if (version) tags_to_add.push(Tag.new(TagType.VERSION, null, version, version));

            if (disc) {
                const m_prefix = disc.match(this.dsc_re);
                if (m_prefix) {
                    const disc_typ_str = m_prefix[0].toUpperCase();
                    const num_str = disc.substring(disc_typ_str.length).trim();
                    if (disc_typ_str === "DVD") {
                        tags_to_add.push(Tag.new(TagType.SOURCE, this.sourcef, disc_typ_str, disc_typ_str));
                        tags_to_add.push(Tag.new(TagType.DISC, null, disc.substring(disc_typ_str.length), disc_typ_str, num_str));
                    } else {
                        tags_to_add.push(Tag.new(TagType.DISC, null, disc, disc_typ_str, num_str));
                    }
                }
            }

            if (multi_season) {
                for (const season_match of multi_season.matchAll(this.mlt_re)) {
                    tags_to_add.push(Tag.new(TagType.SERIES, null, season_match[0], season_match[1], ""));
                }
            }

            if (series && series.length === 4 && series.startsWith('19')) {
                tags_to_add.push(Tag.new(TagType.DATE, null, "", series, "", ""));
            }

            if (tags_to_add.length > 0) {
                start.push(...tags_to_add);
                return [start, end, i + s.length, n, true];
            }
        }
        return [start, end, i, n, false];
    }
}

/**
 * Creates a tag lexer for a music ID, typically found in parentheses.
 * @returns {TagLexer} A lexer for music IDs.
 */
function newIdLexer() {
    const alpha_re = /[A-Z]/g;
    const digit_re = /\d/g;
    const ws_re = /[\-\._ ]/g;
    const main_re = /^([A-Z\d\-\_\. ]{2,24})\)/;
    const lookbehind_re = /\([\._ ]{0,2}$/;

    /** @type {LexFunc} */
    const lex = (parser, src, buf, start, end, i, n) => {	
        if (lookbehind_re.test(src.substring(0, i))) {
            const m = buf.substring(i, n).match(main_re);
            if (m) {
                const text = m[1];
                const a_count = (text.match(alpha_re) || []).length;
                const d_count = (text.match(digit_re) || []).length;
                const w_count = (text.match(ws_re) || []).length;

                const is_id = (a_count === 0 && d_count > 4 && w_count < 4) ||
                              (a_count > 1 && d_count > 1 && (a_count + d_count > 4) && w_count < 4);

                if (is_id) {
                    const full_match = src.substring(i, i + m[0].length);
                    start.push(Tag.new(TagType.ID, null, full_match, text));
                    return [start, end, i + full_match.length, n, true];
                }
            }
        }
        return [start, end, i, n, false];
    };
    return new TagLexer(lex);
}


/**
 * Creates a tag lexer for a single episode number (e.g., `- 2 -`).
 * @returns {TagLexer} A lexer for single episode numbers.
 */
function newEpisodeLexer() {
    const main_re = /^(\d{1,4})(\b|[\._ ]?[\-\[\]\(\)\{\}])/;
    const lookbehind_re = /-[\-\._ ]{1,3}$/;

    /** @type {LexFunc} */
    const lex = (parser, src, buf, start, end, i, n) => {	
        if (lookbehind_re.test(src.substring(0, i))) {
            const m = src.substring(i, n).match(main_re);
            if (m && !src.substring(i + m[1].length).startsWith(',')) {
                const tags = [Tag.new(TagType.SERIES, null, m[1], "", m[1], "")];
                if (m[2]) {
                    tags.push(Tag.new(TagType.DELIM, null, m[2], m[2]));
                }
                start.push(...tags);
                return [start, end, i + m[0].length, n, true];
            }
        }
        return [start, end, i, n, false];
    };
    return new TagLexer(lex);
}

/**
 * A lexer for matching version numbers.
 * @private
 */
class VersionLexer extends Lexer {
    /**
     * @param {...string} strs Regular expression patterns for matching versions.
     */
    constructor(...strs) {
        super(true); // notFirst = true
        this.patterns = strs.map(s => new RE2(s, 'i'));
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for versions.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        for (const pattern of this.patterns) {
            const m = pattern.exec(buf.substring(i, n));
            if (!m) continue;

            const s = src.substring(i, i + m[0].length);
            const groups = m.groups || {};
            let version = "";
            if (groups["v"] != null) {
                version = s.toLowerCase();
                if (version.startsWith("version")) {
                    version = version.substring("version".length).replace(/^[ ._-]+/, '');
                }
                version = version.replace(/ /g, '.');
            } else if (groups["V"] != null) {
                version = groups.V;
            } else if (groups["u"] != null) {
                version = "v" + groups.u;
            }

            if (version) {
                start.push(Tag.new(TagType.VERSION, null, s, version));
                return [start, end, i + m[0].length, n, true];
            }
        }
        return [start, end, i, n, false];
    }
}

/**
 * A lexer for combined disc, source, and year tags (e.g., `2DVD1999`).
 * @private
 */
class DiscSourceYearLexer extends Lexer {
    /**
     * @param {...string} strs Regular expression patterns.
     */
    constructor(...strs) {
        super();
        this.patterns = strs.map(s => new RE2(s, 'i'));
        /** @type {FindFunc|null} */
        this.sourcef = null;
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        this.sourcef = _createFindFunc(...(infos['source'] || []));
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for disc/source/year combos.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        for (const pattern of this.patterns) {
            const m = pattern.exec(buf.substring(i, n));
            if (!m) continue;

            const groups = m.groups || {};
            const { d: disc, s: source, y: year } = groups;

            const tags = [];
            if (disc) tags.push(Tag.new(TagType.DISC, null, disc, "X", disc));
            if (source) tags.push(Tag.new(TagType.SOURCE, this.sourcef, source, source));
            if (year) tags.push(Tag.new(TagType.DATE, null, year, year, "", ""));

            if (tags.length > 0) {
                start.push(...tags);
                return [start, end, i + m[0].length, n, true];
            }
        }
        return [start, end, i, n, false];
    }
}

/**
 * A lexer for matching disc numbers and types (CD, DVD, etc.).
 * @private
 */
class DiscLexer extends Lexer {
    /**
     * @param {...string} strs Regular expression patterns for discs.
     */
    constructor(...strs) {
        super();
        this.patterns = strs.map(s => new RE2(s, 'i'));
        this.re_prefix = /^(dvd|cd|d|s|x)/i;
        /** @type {FindFunc|null} */
        this.sourcef = null;
        /** @type {FindFunc|null} */
        this.sizef = null;
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        this.sourcef = _createFindFunc(...(infos["source"] || []));
        this.sizef = _createFindFunc(...(infos["size"] || []));
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for discs.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        for (const pattern of this.patterns) {
            const m = pattern.exec(buf.substring(i, n));
            if (!m) continue;

            const s = src.substring(i, i + m[0].length);
            const groups = m.groups || {};
            const tags_to_add = [];
            const c = groups["c"];
            if (c == null) continue;

            if (groups["z"]) {
                const z = groups.z.toUpperCase();
                tags_to_add.push(Tag.new(TagType.DISC, null, s.substring(0, c.length + 1), 'X', c));
                tags_to_add.push(Tag.new(TagType.SIZE, this.sizef, s.substring(c.length + 1), z));
            } else if (groups["t"]) {
                const t = groups.t.toUpperCase();
                const m_re = t.match(this.re_prefix);
                const final_type = m_re ? m_re[0].toUpperCase() : "";

                if (["D", "S"].includes(final_type)) {
                    tags_to_add.push(Tag.new(TagType.DISC, null, s, final_type, c));
                } else if (["DVDA", "DVD", "CD"].includes(final_type)) {
                    tags_to_add.push(Tag.new(TagType.SOURCE, this.sourcef, s.substring(0, final_type.length), final_type, final_type));
                    tags_to_add.push(Tag.new(TagType.DISC, null, s.substring(final_type.length), final_type, c));
                } else if (final_type === "X") {
                    const sz_upper = s.substring(c.length + 1).toUpperCase();
                    if (sz_upper === "DVD9") {
                        tags_to_add.push(Tag.new(TagType.DISC, null, s.substring(0, c.length + 1), 'X', c));
                        tags_to_add.push(Tag.new(TagType.SIZE, this.sizef, s.substring(c.length + 1), sz_upper));
                    } else {
                        tags_to_add.push(Tag.new(TagType.DISC, null, s.substring(0, c.length + 1), 'X', c));
                        tags_to_add.push(Tag.new(TagType.SOURCE, this.sourcef, s.substring(c.length + 1), s.substring(c.length + 1)));
                    }
                }
            } else if (groups["x"]) {
                const x = groups.x.toUpperCase();
                tags_to_add.push(Tag.new(TagType.DISC, null, s.substring(0, c.length + 1), 'X', c));
                tags_to_add.push(Tag.new(TagType.SOURCE, this.sourcef, s.substring(c.length + 1), x));
            }

            if (tags_to_add.length > 0) {
                start.push(...tags_to_add);
                return [start, end, i + s.length, n, true];
            }
        }
        return [start, end, i, n, false];
    }
}


/**
 * A lexer for matching audio codecs and properties.
 * @private
 */
class AudioLexer extends Lexer {
    /**
     * @inheritdoc
     */
    constructor() {
        super();
        /** @type {RE2|null} */ this.re = null;
        /** @type {FindFunc|null} */ this.audiof = null;
        /** @type {FindFunc|null} */ this.channelsf = null;
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        const audio_infos = infos['audio'] || [];
        const channels_infos = infos['channels'] || [];

        const v = channels_infos.map(info => info.tag.replace(/\./g, '[\\._ ]?'));
        const audio_re_str = _reutil_build_from_taginfo('^i', ...audio_infos);
        const channels_re_str = v.join('|');

        this.re = new RE2(`${audio_re_str}(?:[\\-\\_\\. ]?(${channels_re_str}))?(?:\\b|[\\-\\_\\. ])`);
        this.audiof = _createFindFunc(...audio_infos);
        this.channelsf = _createFindFunc(...channels_infos);
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for audio tags.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        const m = this.re.exec(src.substring(i, n));
        if (m) {
            // Add check for zero-length match to prevent infinite loops.
            if (m[0].length === 0) {
                return [start, end, i, n, false];
            }
		
            const l = m[0].length;
            const [full_match, audio_match, channels_match] = m;
            let current_match_text = full_match;
            if (channels_match) {
                current_match_text = current_match_text.slice(0, -channels_match.length);
            }

            start.push(Tag.new(TagType.AUDIO, this.audiof, current_match_text, audio_match));
            if (channels_match) {
                start.push(Tag.new(TagType.CHANNELS, this.channelsf, channels_match, channels_match));
            }
            return [start, end, i + l, n, true];
        }
        return [start, end, i, n, false];
    }
}

/**
 * A lexer for matching genres, often found in parentheses.
 * @private
 */
class GenreLexer extends Lexer {
    /**
     * @inheritdoc
     */
    constructor() {
        super();
        /** @type {RegExp|null} */ this.re = null;
        /** @type {RegExp|null} */ this.lb_re = null;
        /** @type {RegExp|null} */ this.other_re = null;
        /** @type {FindFunc|null} */ this.genref = null;
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        const genre_infos = infos['genre'] || [];
        const v = genre_infos.map(info => info.getRePattern());
        const tagv = genre_infos.filter(info => info.other).map(info => info.other);

        const s = `\\(?(${v.join('|')})\\s*\\)`;
        this.re = new RE2(`^${s}`, 'i');
        this.lb_re = new RE2(`\\(\\s*${s}$`, 'i');
        if (tagv.length > 0) {
            this.other_re = new RE2(`^(${tagv.join('|')})\\b`, 'i');
        }
        this.genref = _createFindFunc(...genre_infos);
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for genres.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        let m = this.re.exec(src.substring(i, n));
        if (m && this.lb_re.test(src.substring(0, i + m[0].length))) {
            start.push(Tag.new(TagType.GENRE, this.genref, m[0], m[1]));
            return [start, end, i + m[0].length, n, true];
        }

        if (this.other_re) {
            m = this.other_re.exec(buf.substring(i, n));
            if (m) {
                start.push(Tag.new(TagType.GENRE, this.genref, m[0], m[1]));
                return [start, end, i + m[0].length, n, true];
            }
        }
        return [start, end, i, n, false];
    }
}

/**
 * A lexer for matching the release group, which is typically the last part of a release name.
 * @private
 */
class GroupLexer extends Lexer {
    /**
     * @inheritdoc
     */
    constructor() {
        super(false, true); // notFirst = false, once = true
        this.delim = '-';
        this.invalid = ' _.()[]{}+';
        this.year_re = /\b(19|20)\d{2}\b/g;
        this.group_re = /^[a-z0-9_ ]{2,10}$/i; // Allow numbers in group names
        this.bracket_re = /^[\]\)\}]/;
        /** @type {FindFunc|null} */
        this.groupf = null;
        /** @type {FindFunc|null} */
        this.otherf = null;
        /** @type {RE2|null} */
        this.re = null;
        /** @type {RegExp|null} */
        this.special_re = null;
        /** @type {TagParser|null} */
        this.parser = null;
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        this.parser = parser;
        const group_infos = infos["group"] || [];
        const other_infos = infos["other"] || [];
        const v = other_infos.filter(info => info.other).map(info => info.other);

        this.groupf = _createFindFunc(...group_infos);
        this.otherf = _createFindFunc(...other_infos);

        const group_re_str = _reutil_build_from_taginfo('$', ...group_infos);
        this.re = new RE2(`[\\-\\_\\. ](${group_re_str})`, 'i'); // Capture the group name
        if (v.length > 0) {
            this.special_re = new RegExp(`_(${v.join('|')})$`, 'i');
        }

        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for groups.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        if (this.special_re) {
            const m = src.substring(i, n).match(this.special_re);
            if (m) {
                const match_len = m[0].length;
                end.unshift(Tag.new(TagType.OTHER, this.otherf, m[0], m[1]));
                n -= match_len;
            }
        }
        
        let m = this.re.exec(src.substring(i, n));
        if (m) {
            const match_len = m[0].length;
            end.unshift(Tag.new(TagType.GROUP, this.groupf, m[0], m[1]));
            return [start, end, i, n - match_len, true];
        }

        let l = i;
        const matches = [...buf.substring(l, n).matchAll(this.year_re)];
        if (matches.length > 0) {
            l = l + matches[0].index + matches[0][0].length;
        }

        const searchSlice = buf.substring(l, n);
        let j = searchSlice.lastIndexOf(this.delim);

        if (j !== -1) {
            j += l;
	    
            const s = src.substring(j + 1, n);
            const grp = s.replace(/^[ \t_]+|[ \t_]+$/g, '');
            const invalidChars = [...this.invalid].some(c => s.includes(c));

            const is_valid_grp = grp.length !== 0 &&
                (!invalidChars || (s.length <= 14 && this.group_re.test(grp))) &&
                !this.parser.short_map[grp.toUpperCase()] &&
                (end.length === 0 || !this.bracket_re.test(end[0].text()));

            if (is_valid_grp) {
                const group_tag = Tag.new(TagType.GROUP, null, s, grp);
                const delim_tag = Tag.new(TagType.DELIM, null, src.substring(j, j + 1), this.delim);
                end.unshift(group_tag);
                end.unshift(delim_tag);
                return [start, end, i, j, false];		    
            }
        }
        return [start, end, i, n, false];
    }
}

/**
 * A lexer for matching metadata tags (e.g., `[site:example.com]`, `[REQ]`).
 * @private
 */
class MetaLexer extends Lexer {
    /**
     * @param {...string} strs A flattened list of [key, start_delim, end_delim, pattern] for each meta type.
     */
    constructor(...strs) {
        super(false, true);
        if (strs.length % 4 !== 0) throw new Error("MetaLexer must be initialized with a multiple of 4 strings");

        this.prefixes = [];
        this.suffixes = [];
        this.has_two = [];
        this.str_map = [];
        this.delim_re = null;
        /** @type {TagParser|null} */
        this.parser = null;

        for (let l = 0; l < strs.length / 4; l++) {
            const [k, start_delim, end_delim, patternStr] = strs.slice(l * 4, (l + 1) * 4);
            this.str_map.push([k, start_delim, end_delim, patternStr]);

            const s = `\\s*${escapeRegex(start_delim)}\\s*${patternStr}\\s*${escapeRegex(end_delim)}\\s*`
            const prefix = new RE2(`^${s}`);
            const suffix = new RE2(`${s}$`);		
            this.prefixes.push(prefix);
            this.suffixes.push(suffix);

            const num_groups = (new RegExp(patternStr + '|')).exec('').length - 1;
            if (num_groups !== 1 && num_groups !== 2) {
                throw new Error("MetaLexer patterns must have 1 or 2 capture groups");
            }
            this.has_two.push(num_groups === 2);
        }
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        this.parser = parser;
        this.delim_re = delimRe;
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for metadata.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        const prev = {};
        let d_prefix = "";

        while (i < n) {
            let matched_this_iter = false;
            for (let l = 0; l < this.prefixes.length; l++) {
                const m = this.prefixes[l].exec(src.substring(i, n));
                if (m) {
                    let k, v;
                    if (this.has_two[l]) {
                        k = m[1]; v = m[2];
                    } else {
                        k = this.str_map[l][0]; v = m[1];
                    }

                    const is_short = this.str_map[l][1].length === 1 && this.parser.short_map[v.toUpperCase()];
                    const contains_invalid = /[ \t\r\n\f+]/.test(v);

                    if (!prev[k] && !is_short && !contains_invalid) {
                        matched_this_iter = true;
                        prev[k] = true;
                        if (d_prefix) {
                            start.push(Tag.new(TagType.DELIM, null, d_prefix, d_prefix));
                            d_prefix = "";
                        }
                        start.push(Tag.new(TagType.META, null, m[0], k, v));
                        i += m[0].length;
                        break;
                    }
                }
            }
            if (matched_this_iter) continue;

            if (i < n && this.delim_re.test(src[i])) {
                d_prefix += src[i];
                i++;
            } else {
                break;
            }
        }

        if (d_prefix) {
            i -= d_prefix.length;
        }

        let d_suffix = "";
        while (i < n) {
            let matched_this_iter = false;
            for (let l = 0; l < this.suffixes.length; l++) {
                const sub = src.substring(i, n);
                const m = this.suffixes[l].exec(sub);
                if (m && m.index + m[0].length === sub.length) {
                    let k, v;
                     if (this.has_two[l]) {
                        k = m[1]; v = m[2];
                    } else {
                        k = this.str_map[l][0]; v = m[1];
                    }

                    const is_short = this.str_map[l][1].length === 1 && this.parser.short_map[v.toUpperCase()];
                    const contains_invalid = /[ \t\r\n\f+]/.test(v);

                    if (!prev[k] && !is_short && !contains_invalid) {
                        prev[k] = true;
                        if (d_suffix) {
                            end.unshift(Tag.new(TagType.DELIM, null, d_suffix, d_suffix));
                            d_suffix = "";
                        }
                        end.unshift(Tag.new(TagType.META, null, m[0], k, v));
                        n -= m[0].length;
                        matched_this_iter = true;
                        break;
                    }
                }
            }
            if (matched_this_iter) continue;

            if (i < n && this.delim_re.test(src[n - 1])) {
                d_suffix = src[n - 1] + d_suffix;
                n--;
            } else {
                break;
            }
        }
        if (d_suffix) {
            end.unshift(Tag.new(TagType.DELIM, null, d_suffix, d_suffix));
        }

        return [start, end, i, n, true];
    }
}

/**
 * A lexer for matching file extensions at the end of a string.
 * @private
 */
class ExtLexer extends Lexer {
    /**
     * @inheritdoc
     */
    constructor() {
        super(false, true);
        /** @type {RE2|null} */ this.re = null;
        /** @type {FindFunc|null} */ this.extf = null;
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        const ext_infos = infos['ext'] || [];
        const ext_re_str = _reutil_build_from_taginfo('$', ...ext_infos); 
        this.re = new RE2(`\\.${ext_re_str}`, 'i');
        this.extf = _createFindFunc(...ext_infos);
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for extensions.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        const m = this.re.exec(src.substring(i, n));
        if (m && (i + m.index + m[0].length === n)) { // Must be at the very end
            const match_len = m[0].length;
            end.unshift(Tag.new(TagType.EXT, this.extf, m[0], m[1]));
            return [start, end, i, n - match_len, true];
        }
        return [start, end, i, n, false]; 
    }
}

/**
 * Creates a lexer for file extensions.
 * @returns {ExtLexer}
 */
function newExtLexer() {
    return new ExtLexer();
}

/**
 * A generic lexer that uses a regular expression built from TagInfo definitions.
 * @private
 */
class RegexpLexer extends Lexer {
    /**
     * @param {TagType} typ The type of tag this lexer will create.
     * @param {boolean} ignoreCase Whether the regex should be case-insensitive.
     */
    constructor(typ, ignoreCase) {
        super();
        this.typ = typ;
        this.ignoreCase = ignoreCase;
        /** @type {FindFunc|null} */ this.findFunc = null;
        /** @type {import('re2')|null} */ this.re = null;
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        const typeStr = Object.keys(TagType).find(k => TagType[k] === this.typ).toLowerCase();
        const type_infos = infos[typeStr] || [];
        const s = this.ignoreCase ? 'ib' : 'b';
        const re_str = _reutil_build_from_taginfo(`^${s}`, ...type_infos);
        this.re = new RE2(re_str);
        this.findFunc = _createFindFunc(...type_infos);
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for this generic lexer.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        const m = this.re.exec(buf.substring(i, n)); 
        if (m) {
            const full_match = src.substring(i, i + m[0].length);
            const groups = [full_match, ...m.slice(1)];
            if (full_match.length === 0) {
                return [start, end, i, n, false];
            }
            start.push(Tag.new(this.typ, this.findFunc, ...groups));
            return [start, end, i + full_match.length, n, true];		
        }
        return [start, end, i, n, false];
    }
}

/**
 * A generic lexer similar to RegexpLexer but designed for tags that can be followed
 * by a delimiter that is part of the match but not the tag itself.
 * @private
 */
class RegexpSourceLexer extends Lexer {
    /**
     * @param {TagType} typ The type of tag this lexer will create.
     * @param {boolean} ignoreCase Whether the regex should be case-insensitive.
     */
    constructor(typ, ignoreCase) {
        super();
        this.typ = typ;
        this.ignoreCase = ignoreCase;
        /** @type {FindFunc|null} */ this.findFunc = null;
        /** @type {import('re2')|null} */ this.re = null;
    }

    /**
     * @inheritdoc
     */
    initialize(parser, infos, delimRe) {
        const typeStr = Object.keys(TagType).find(k => TagType[k] === this.typ).toLowerCase();
        const type_infos = infos[typeStr] || [];
        const s = this.ignoreCase ? '^i' : '^';
        const re_str = _reutil_build(s, ...type_infos.map(info => info.getRePattern()));	    
        this.re = new RE2(`${re_str}(?:\\b|[\\-\\_\\. ])`);
        this.findFunc = _createFindFunc(...type_infos);
        this.lexFunc = this._lex.bind(this);
        return this.lexFunc;
    }

    /**
     * The lexing function for this lexer.
     * @private
     */
    _lex(parser, src, buf, start, end, i, n) {	
        const m = this.re.exec(src.substring(i, n)); 
        if (m) {
            const full_match = src.substring(i, i + m[0].length);		
            if (full_match.length === 0) {
                return [start, end, i, n, false];
            }		
            const main_capture = src.substring(i, i + m[1].length);		

            if (full_match.length !== main_capture.length) {
                const v_str = src.substring(i, i + main_capture.length);
                const delim_str = src.substring(i + main_capture.length, i + full_match.length);
		    
                start.push(Tag.new(this.typ, this.findFunc, v_str, v_str));
                start.push(Tag.new(TagType.DELIM, null, delim_str, delim_str));
            } else {
                const groups = [full_match, ...m.slice(1).map(g => src.substring(i, i + g.length))];		    
                start.push(Tag.new(this.typ, this.findFunc, ...groups));
            }
            return [start, end, i + full_match.length, n, true];
        }
        return [start, end, i, n, false];
    }
}


/** @type {(() => Lexer)[] | null} */
let _LEXER_TYPES = null;
/**
 * Returns the default list of lexer factory functions in their correct order of precedence.
 * @returns {(() => Lexer)[]} An array of functions, each returning a Lexer instance.
 */
function defaultLexerTypes() {
    if (_LEXER_TYPES === null) {
        _LEXER_TYPES = [
            // --------------- once ---------------
            () => newTrimWhitespaceLexer(),
            () => new ExtLexer(),
            () => new MetaLexer(
                // [[ type:value ]]
                "", "[[", "]]", "([a-zA-Z][a-zA-Z0-9_]{0,15}):\\s*([^ \t\\]]{1,32})",
                // [REQ]
                "req", "[", "]", "(REQ(?:UEST)?)",
                // (REQ)
                "req", "(", ")", "(REQ(?:UEST)?)",
                // {REQ}
                "req", "{", "}", "(REQ(?:UEST)?)",
                // [ABCD1234]
                "sum", "[", "]", "([0-9A-F]{8})",
                // [site]
                "site", "[", "]", "([^ \t\\]]{1,32})",
                // -={site}=-
                "site", "-={", "}=-", "([^ \t\\}]{1,32})",
                // {{pass}}
                "pass", "{{", "}}", "([^ \t}]{1,32})",
            ),
            () => new GroupLexer(),
            // --------------- multi ---------------
            () => new RegexpLexer(TagType.SIZE, true),
            () => new RegexpLexer(TagType.PLATFORM, true),
            () => new RegexpLexer(TagType.ARCH, true),
            () => new RegexpLexer(TagType.SOURCE, true),
            () => new RegexpLexer(TagType.RESOLUTION, true),
            () => new RegexpSourceLexer(TagType.COLLECTION, true),
            () => new SeriesLexer(
                // s02, S01E01
                '^s(?P<s>[0-8]?\\d)[\\-\\_\\. ]?(?:e(?P<e>\\d{1,5}))?\\b',
                // S01E02E03, S01E02-E03, S01E03.E04.E05
                '^s(?P<s>[0-8]?\\d)(?P<m>(?:[\\-\\_\\. ]?e\\d{1,5}){1,5})\\b',
                // S01S02S03
                '^(?P<S>(?:s[0-8]?\\d){2,4})\\b',
                // 2x1, 1x01
                '^(?P<s>[0-8]?\\d)x(?P<e>\\d{1,3})\\b',
                // S01 - 02v3, S07-06, s03-5v.9
                '^s(?P<s>[0-8]?\\d)[\\-\\_\\. ]{1,3}(?P<e>\\d{1,5})(?:[\\-\\_\\. ]{1,3}(?P<v>v\\d+(?:\\.\\d+){0,2}))?\\b',
                // Season.01.Episode.02, Series.01.Ep.02, Series.01, Season.01
                '^(?:series|season|s)[\\-\\_\\. ]?(?P<s>[0-8]?\\d)(?:[\\-\\_\\. ]?(?:episode|ep)(?P<e>\\d{1,5}))?\\b',
                // Vol.1.No.2, vol1no2
                '^vol(?:ume)?[\\-\\_\\. ]?(?P<s>\\d{1,3})(?:[\\-\\_\\. ]?(?:number|no)[\\-\\_\\. ]?(?P<e>\\d{1,5}))\\b',
                // Episode 15, E009, Ep. 007, Ep.05-07
                '^e(?:p(?:isode)?[\-\\_\\. ]{1,3})?(?P<e>\\d{1,5})(?:[\\-\\_\\. ]{1,3}\\d{1,3})?\\b',
                // 10v1.7, 13v2
                '^(?P<e>\\d{1,5})(?P<v>v[\\-\\_\\. ]?\\d+(?:\\.\\d){0,2})\\b',
                // S01.Disc02, s01D3, Series.01.Disc.02, S02DVD3
                '^(?:series|season|s)[\\-\\_\\. ]?(?P<s>[0-8]?\\d)[\\-\\_\\. ]?(?P<d>(?:disc|disk|dvd|d)[\\-\\_\\. ]?(?:\\d{1,3}))\\b',
                // s1957e01
                '^s(?P<s>19\\d\\d)e(?P<e>\\d{2,4})\\b',
            ),
            () => new DiscSourceYearLexer(
                // VLS2004, 2DVD1999, 4CD2003
                '^(?P<d>[2-9])?(?P<s>cd|ep|lp|dvd|vls|vinyl)(?P<y>(?:19|20)\\d\\d)\\b',
                // WEB2007
                '^(?P<s>web)(?P<y>20\\d\\d)\\b',
            ),
            () => new DiscLexer(
                // D01, Disc.1
                '^(?P<t>d)(?:is[ck][\\-\\_\\. ])?(?P<c>\\d{1,3})\\b',
                // 12DiSCS
                '^(?P<c>\\d{1,3})[\\-\\_\\. ]?di(?P<t>s)[ck]s?\\b',
                // CD1, CD30
                '^(?P<t>cd)[\\-\\_\\. ]?(?P<c>\\d{1,2})\\b',
                // DVD2, DVD24 -- does not match DVD5/DVD9
                '^(?P<t>dvd)[\\-\\_\\. ]?(?P<c>[1-46-8]|[12]\\d)\\b',
                // 2xDVD9
                '^(?P<c>\\d{1,2})(?P<t>x(?:dvd9))\\b',
                // 2DVD9, 6DVD9
                '^(?P<c>[2-9])(?P<z>dvd9)\\b',
                // 2xVinyl, 3xDVD, 4xCD
                '^(?P<c>\\d{1,2})(?P<t>x(?:cd|ep|lp|dvda|dvd|vls|vinyl)s?)\\b',
                // 2Vinyl, 6DVD
                '^(?P<c>\\d{1,2})(?P<x>(?:cd|ep|lp|dvda|dvd|vls|vinyl)s?)\\b',
                // CDS3
                '^(?:(?P<x>cd)s)(?P<c>\\d{1,2})\\b',
                // 2CDS
                '^(?P<c>[2-9])(?P<x>cds)\\b',
            ),
            () => new DateLexer(
                // 2006-01-02, 2006
                '(?i)^(?P<2006>(?:19|20)\\d{2})(?:[\\-\\_\\. ](?P<01>\\d{2})[\\-\\_\\. ](?P<02>\\d{2}))?\\b',
                // 2006-01
                '(?i)^(?P<2006>(?:19|20)\\d{2})?:[\\-\\_\\. ](?P<01>\\d{2})\\b',
                // 13-02-2006
                '(?i)^(?P<01>\\d{2})[\\-\\_\\. ](?P<02>\\d{2})[\\-\\_\\. ](?P<2006>(?:19|20)\\d{2})\\b',
                // 02-13-2006
                '(?i)^(?P<02>\\d{2})[\\-\\_\\. ](?P<01>\\d{2})[\\-\\_\\. ](?P<2006>(?:19|20)\\d{2})\\b',
                // 2nd Jan 2006, 13 Dec 2011, Nov 1999
                '(?i)^(?:(?P<_2>\\d{1,2})(?:th|st|nd|rd)?[\\-\\_\\. ])?(?P<Jan>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\\-\\_\\. ](?P<2006>(?:19|20)\\d{2})\\b',
                // 01-August-1998
                '(?i)^(?P<_2>\\d{1,2})[\\-\\_\\. ](?P<January>January|February|March|April|May|June|July|August|September|October|November|December)[\\-\\_\\. ](?P<2006>(?:19|20)\\d{2})\\b',
                // MAY-30-1992
                '(?i)^(?P<Jan>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\\-\\_\\. ](?P<_2>\\d{1,2})[\\-\\_\\. ](?P<2006>(?:19|20)\\d{2})\\b',
                // 17.12.15, 20-9-9
                '(?i)^(?P<YY>[12]\\d)[\\-\\_\\. ](?P<01>\\d\\d?)[\\-\\_\\. ](?P<02>\\d\\d?)\\b',
            ),		
            () => new VersionLexer(
                // v1.17, v1, v1.2a, v1b
                '^(?:version[\\-\\_\\. ])?(?P<v>v[\\-\\_\\. ]?\\d{1,2}(?:[\\._ ]\\d{1,2}[a-z]?\\d*){0,3})\\b',
                // v2012, v20120803, v20120803, v1999.08.08
                '^(?:version[\\-\\_\\. ])?(?P<v>v[\\-\\_\\. ]?(?:19|20)\\d\\d(?:[\\-\\_\\. ]?\\d\\d?){0,2})\\b',
                // v60009
                '^(?:version[\\-\\_\\. ])?(?P<v>v[\\-\\_\\. ]?\\d{4,10})\\b',
                // Version 2004, Version 21H2, Version 22H1
                '^version[\\-\\_\\. ](?P<V>\\d{2,}|\\d{2}[a-z]{1,2}\\d{1,2})\\b',
                // 11.09.1, 100.000.99999999999, 23.3.2.458
                '^(?P<u>\\d{1,3}\\.\\d{1,3}\\.\\d{1,16}(\\.\\d{1,16})?)\\b',
            ),
            () => new RegexpSourceLexer(TagType.CODEC, true),
            () => new RegexpSourceLexer(TagType.HDR, true),
            () => new AudioLexer(),
            () => new RegexpLexer(TagType.CHANNELS, true),
            () => new RegexpLexer(TagType.OTHER, true),
            () => new RegexpLexer(TagType.CUT, true),
            () => new RegexpLexer(TagType.EDITION, true),
            () => new RegexpLexer(TagType.LANGUAGE, false),
            () => new RegexpLexer(TagType.REGION, true),
            () => new RegexpLexer(TagType.CONTAINER, true),
            () => new GenreLexer(),
            () => newIdLexer(),
            () => newEpisodeLexer(),
        ];
    }
    return _LEXER_TYPES;
}


// ----------------------------------------------------------------------
// 5. Parser and Builder Implementation (Internal)
// ----------------------------------------------------------------------

/**
 * Checks if the tag at a given index is of one of the specified types.
 * @param {Tag[]} tags The array of tags to check.
 * @param {number} i The index to check.
 * @param {...TagType} types The types to check for.
 * @returns {boolean} True if the tag at the index exists and matches one of the types.
 * @private
 */
function _peek(tags, i, ...types) {
    return i >= 0 && i < tags.length && tags[i].is(...types);
}

/**
 * Determines if a tag is "isolated" by non-text/whitespace tags in a given direction.
 * A tag is isolated if, by moving in the given direction (increment), we eventually hit a Text tag.
 * @param {Tag[]} tags The array of tags to check.
 * @param {number} i The starting index of the tag to check.
 * @param {number} inc The direction to check in (-1 for backward, +1 for forward).
 * @returns {boolean} True if the tag is isolated.
 * @private
 */
function _isolated(tags, i, inc) {
    let j = i + inc;
    while (j > 0 && j < tags.length - 1 && tags[j].is(TagType.WHITESPACE, TagType.DELIM)) {
        j += inc;
    }
    // The original Go code had an off-by-one error here that was corrected in JS.
    // This logic now correctly checks the tag at the end of the delimiter chain.
    return j >= 0 && j < tags.length && tags[j].is(TagType.TEXT);
}

/** Checks if a character is any kind of delimiter. */
const isAnyDelim = (s) => /[\t\n\f\r ()+,\-._/\\\[\]{}~]/.test(s);
/** Checks if a character is a delimiter that should be trimmed from titles. */
const isTitleTrimDelim = (s) => /[\t\n\f\r ()-,'_/\\\[\]{}~]/.test(s);

/** Checks if a character is an uppercase letter. */
const isUpperLetter = (s) => s.length === 1 && s >= 'A' && s <= 'Z';
/** Checks if a character is a digit. */
const isDigit = (s) => s.length === 1 && s >= '0' && s <= '9';
	
/**
 * The release builder, responsible for taking a stream of parsed tags and
 * intelligently assembling them into a structured Release object. This class
 * contains the core logic for interpreting and fixing ambiguous tags.
 */
class TagBuilder {
    /**
     * Creates a new release builder.
     */
    constructor() {
        this.is_title_trim_delim = " \t\n\f\r() ,-_[]{}~/\\";
        this.is_break_delim = " \t\n\f\r()+,._[]{}~/\\";        
        this.missing_re = /\b[A-Z][\. ][A-Z](?:[\. ][A-Z])*[\. ]?\b/g;
        this.bad_re = /[^A-Z][-\. ][A-Z]\.($|[^A-Z])/g;
        this.fix_re = /([A-Z])\./g;
        this.spaces_re = /\s+/g;
        this.ellips_re = /\.{3,}/g;
        this.plus_re = /(\+)/g;
        this.sum_re = /^[a-f0-9]{8}$/i;
        this.digits_re = /^\d+$/;
        this.digpre_re = /^\d+/;
        this.digsuf_re = /\d+$/;
        /** @type {Object<string, TagInfo[]>} */
        this.infos = {};
        /** @type {FindFunc|null} */
        this.containerf = null;
        /** @type {FindFunc|null} */
        this.audiof = null;
    }

    /**
     * Initializes the builder with tag information.
     * @param {Object<string, TagInfo[]>} infos A map of all tag information.
     * @returns {this} The initialized builder instance.
     */
    initialize(infos) {
        this.infos = infos;
        this.containerf = _createFindFunc(...(infos['container'] || []));
        this.audiof = _createFindFunc(...(infos['audio'] || []));
        return this;
    }

    /**
     * Builds a Release object from a list of parsed tags.
     * This is the main orchestrator for turning a token stream into a structured object.
     * @param {Tag[]} tags The array of tags from the parser.
     * @param {number} endIndex The index separating start tags from end tags.
     * @returns {Release} The fully constructed Release object.
     */
    build(tags, endIndex) {
        const r = new Release(tags, endIndex);
        this._initTags(r);
        this._collect(r);
        r.type = this._inspect(r, true);
        this._unset(r);

        this._recollectFields(r);
        r.type = this._inspect(r, false);

        this._specialDate(r);
        const titleEndIndex = this._titles(r);
        this._unused(r, titleEndIndex);
        return r;
    }
    
    /**
     * A faster version of `build` that only determines the release type.
     * It performs enough parsing to make an educated guess about the type but skips
     * the full title and metadata extraction.
     * @param {Tag[]} tags The array of tags from the parser.
     * @param {number} endIndex The index separating start tags from end tags.
     * @returns {Release} A partially-filled Release object, primarily with the `type` field set.
     */
    buildTypeOnly(tags, endIndex) {
        const r = new Release(tags, endIndex);
        this._initTags(r);
        this._collect(r);
        r.type = this._inspect(r, true);
        this._unset(r);

        this._recollectFields(r);
        r.type = this._inspect(r, false);
        return r;
    }

    /**
     * Resets the fields of a Release object and re-collects them from the tags.
     * This is used after a pass of parsing might have changed tag types.
     * @param {Release} r The Release object to modify.
     */
    _recollectFields(r) {
        const cleanRelease = new Release();
        for (const key in cleanRelease) {
            if (!['tags', 'dates', 'unused', 'end'].includes(key)) {
                r[key] = cleanRelease[key];
            }
        }
        this._collect(r);
    }

    /**
     * Initializes and "fixes" the initial tag set before collection.
     * This crucial step handles ambiguous tags, resets incorrectly identified tags, and prepares the tag stream for interpretation.
     * @param {Release} r The Release object with the initial tag list.
     */
    _initTags(r) {
        this._fixFirstDate(r);
        const [pivotMap, pivotPos] = this._pivots(r, TagType.DATE, TagType.SOURCE, TagType.SERIES, TagType.RESOLUTION, TagType.VERSION);
        const datePos = pivotMap[TagType.DATE] ?? -1;
        const seriesPos = pivotMap[TagType.SERIES] ?? -1;

        if (datePos !== -1) r.dates.push(datePos);
        const resetDates = this._reset(r, datePos, TagType.DATE);
        if (resetDates.length > 0) r.dates.push(...resetDates);

        if (datePos !== -1 || seriesPos !== -1) {
            const i = Math.min(...[datePos, seriesPos].filter(p => p !== -1));
            this._fixSpecial(r, i, seriesPos !== -1);
        }

        const textEndPos = this._textEnd(r, pivotPos);
        this._reset(r, textEndPos, TagType.LANGUAGE, TagType.ARCH, TagType.PLATFORM);
        this._fixFirst(r);

        const textStartPos = this._textStart(r, 0);
        this._fixBad(r, textStartPos, textEndPos);
        this._fixNoText(r, textEndPos);
        this._fixIsolated(r);
        this._fixMusic(r);
    }

    /**
     * Fixes the special case of a date occurring before the main title text
     * when there are no other date tags, which is often a mistake.
     * E.g., `2022.Movie.Title.mkv` should be `Movie.Title` with year 2022, not title `2022.Movie.Title`.
     * @param {Release} r The Release object.
     */
    _fixFirstDate(r) {
        let lastDateIdx = -1;
        for (let i = r.end - 1; i >= 0; i--) {
            if (r.tags[i].is(TagType.DATE)) {
                lastDateIdx = i;
                break;
            }
        }
        if (lastDateIdx === -1) return;

        let firstNonDelimIdx = 0;
        while (firstNonDelimIdx < r.end && r.tags[firstNonDelimIdx].is(TagType.WHITESPACE, TagType.DELIM)) {
            firstNonDelimIdx++;
        }
        if (firstNonDelimIdx >= r.end) return;
        if (firstNonDelimIdx < lastDateIdx) return;
        if (_peek(r.tags, firstNonDelimIdx - 1, TagType.DELIM) && r.tags[firstNonDelimIdx - 1].delim().endsWith('(')) return;

        if (r.tags[firstNonDelimIdx].is(TagType.DATE)) {
            r.tags[firstNonDelimIdx] = r.tags[firstNonDelimIdx].as(TagType.TEXT, null);
        }
    }

    /**
     * Finds the last position for specified "pivot" tags (like Date, Source, etc.).
     * These tags often signal the end of the title and the start of metadata.
     * @param {Release} r The Release object.
     * @param {...TagType} types The pivot tag types to search for.
     * @returns {[Object<TagType, number>, number]} A map of tag types to their last found index, and the earliest (rightmost) pivot position.
     */
    _pivots(r, ...types) {
        const pivotMap = Object.fromEntries(types.map(t => [t, -1]));
        let earliestPos = -1;

        for (let i = r.end - 1; i >= 0; i--) {
            const tagType = r.tags[i].typ;
            if (types.includes(tagType) && pivotMap[tagType] === -1) {
                pivotMap[tagType] = i;
                earliestPos = i;
            }
        }
        return [pivotMap, earliestPos === -1 ? r.end : earliestPos];
    }

    /**
     * Resets any tags of the given types that appear before a specified index,
     * changing them back to generic TEXT tags.
     * @param {Release} r The Release object.
     * @param {number} i The index before which to reset tags.
     * @param {...TagType} types The tag types to reset.
     * @returns {number[]} The indices of the tags that were reset.
     */
    _reset(r, i, ...types) {
        const resetIndices = [];
        if (i === -1) i = r.tags.length;
        for (let j = i - 1; j >= 0; j--) {
            if (r.tags[j].is(...types)) {
                r.tags[j] = r.tags[j].as(TagType.TEXT, null);
                resetIndices.push(j);
            }
        }
        return resetIndices;
    }

    /**
     * Finds the first TEXT tag starting from a given index.
     * @param {Release} r The Release object.
     * @param {number} i The starting index.
     * @returns {number} The index of the first text tag.
     */
    _textStart(r, i) {
        while (i < r.end && !r.tags[i].is(TagType.TEXT)) i++;
        return i;
    }

    /**
     * Finds the first TEXT tag searching backwards from a given index.
     * @param {Release} r The Release object.
     * @param {number} i The starting index.
     * @returns {number} The index of the first text tag.
     */
    _textEnd(r, i) {
        while (i > 0 && !r.tags[i - 1].is(TagType.TEXT)) i--;
        return i;
    }

    /**
     * Fixes the first non-delimiter tag if it was badly matched as metadata.
     * A release name should not start with a metadata tag.
     * @param {Release} r The Release object.
     */
    _fixFirst(r) {
        let i = 0;
        while (i < r.end && r.tags[i].is(TagType.WHITESPACE, TagType.DELIM)) i++;
        if (i < r.end && r.tags[i].is(
            TagType.PLATFORM, TagType.ARCH, TagType.SOURCE, TagType.RESOLUTION,
            TagType.CODEC, TagType.HDR, TagType.AUDIO, TagType.OTHER, TagType.CUT,
            TagType.EDITION, TagType.LANGUAGE, TagType.REGION)) {
            r.tags[i] = r.tags[i].as(TagType.TEXT, null);
        }
    }

    /**
     * Fixes incorrectly identified tags that appear within the title part of the release.
     * For example, a language tag appearing in the middle of a title is likely part of the title itself.
     * @param {Release} r The Release object.
     * @param {number} start The starting index of the title text.
     * @param {number} end The ending index of the title text.
     */
    _fixBad(r, start, end) {
        let i = end;
        while (i > start && r.tags[i - 1].is(TagType.LANGUAGE, TagType.EDITION, TagType.CUT, TagType.OTHER, TagType.COLLECTION, TagType.DELIM, TagType.SOURCE)) {
            i--;
        }

        for (let j = i - 1; j >= start; j--) {
            const tag = r.tags[j];
            const is_imax = tag.is(TagType.COLLECTION) && tag.collection() === "IMAX";
            const is_remix = tag.is(TagType.OTHER) && tag.other() === "REMiX";
            if (is_imax || is_remix) continue;

            if ((tag.is(TagType.COLLECTION) && ["CC", "RED"].includes(tag.collection())) ||
                (tag.is(TagType.COLLECTION) && tag.collection() === "AMZN" && tag.text().toLowerCase() === "amazon") ||
                (tag.is(TagType.SOURCE) && tag.text() === "Web") ||
                (tag.is(TagType.CUT) && tag.text() === "Uncut") ||
                (tag.is(TagType.OTHER) && ["MD", "RESTORATiON"].includes(tag.other())) ||
                (tag.is(TagType.CUT) && tag.text().toLowerCase() === "dc")) {
                continue;
            }
            if (tag.is(TagType.COLLECTION, TagType.LANGUAGE, TagType.OTHER, TagType.ARCH, TagType.PLATFORM)) {
                r.tags[j] = tag.as(TagType.TEXT, null);
            }
        }
    }

    /**
     * Fixes special collection and other tags that might be part of the title.
     * This handles specific known false positives.
     * @param {Release} r The Release object.
     * @param {number} i The index before which to perform fixes.
     * @param {boolean} series Whether a series tag was detected.
     */
    _fixSpecial(r, i, series) {
        for (let j = i - 1; j >= 0; j--) {
            const tag = r.tags[j];
            const { typ } = tag;
            const c = tag.collection ? tag.collection() : '';
            const o = tag.other ? tag.other() : '';
            const t = tag.text();
            const t_lower = t.toLowerCase();

            if ((typ === TagType.COLLECTION && (c === "CC" || c === "RED" || (c === "AMZN" && t_lower === "amazon"))) ||
                (typ === TagType.SOURCE && t === "Web") ||
                (typ === TagType.CUT && t === "Uncut") ||
                (typ === TagType.OTHER && (o === "MD" || o === "RESTORATiON")) ||
                (typ === TagType.CUT && t_lower === "dc") ||
                (series && [TagType.ARCH, TagType.PLATFORM].includes(typ))) {
                r.tags[j] = tag.as(TagType.TEXT, null);
            }
        }
    }

    /**
     * Fixes the case where a release has no TEXT tags but has a collection tag,
     * which is likely the actual title.
     * @param {Release} r The Release object.
     * @param {number} end The end index of the title segment.
     */
    _fixNoText(r, end) {
        const hasText = r.tags.slice(0, Math.min(end + 1, r.tags.length)).some(t => t.is(TagType.TEXT));
        if (hasText) return;
        for (let i = 0; i < Math.min(end + 1, r.tags.length); i++) {
            if (r.tags[i].is(TagType.COLLECTION)) {
                r.tags[i] = r.tags[i].as(TagType.TEXT, null);
            }
        }
    }

    /**
     * Fixes isolated metadata tags that are surrounded by text tags, which indicates they are likely part of the title.
     * @param {Release} r The Release object.
     */
    _fixIsolated(r) {
        // if tag is isolated with text on both sides, change to text
        // This loop structure is a direct port of the Go implementation.
        for (let i = r.end - 2; i > 0; i--) {
            const tag = r.tags[i];
            if (tag.is(TagType.COLLECTION, TagType.LANGUAGE, TagType.OTHER, TagType.ARCH, TagType.PLATFORM)) {

                if (tag.is(TagType.OTHER) && tag.other() === "REMiX") {
                    continue;
                }

                const isIsolatedBackward = _isolated(r.tags.slice(0, r.end), i, -1);
                if (!isIsolatedBackward) {
                    continue;
                }

                const isIsolatedForward = _isolated(r.tags.slice(0, r.end), i, 1);
                if (!isIsolatedForward) {
                    continue;
                }

                let j = i + 1;
                while(j < r.end && !r.tags[j].is(TagType.TEXT)) j++;

                if (j === r.end - 1 || (j < r.end -1 && r.tags[j+1].is(TagType.DELIM, TagType.WHITESPACE) && j+2 === r.end)) {
                     continue;
                }
                r.tags[i] = tag.as(TagType.TEXT, null);
            }
        }
    }

    /**
     * Applies fixes specific to music releases.
     * This includes disambiguating `CBR` (comic vs. audio), `16bit` (arch vs. audio),
     * and improperly identified `BOOTLEG` tags.
     * @param {Release} r The Release object.
     */
    _fixMusic(r) {
        let count_cbr = 0, pos_cbr = 0, has_cbr = false, music_excl = false;
        
        const audio_tags = r.tags.slice(0, r.end).filter(t => t.is(TagType.AUDIO));
        if (audio_tags.some(t => t.infoExcl())) {
            music_excl = true;
        }

        for (let i = 0; i < r.end; i++) {
            const tag = r.tags[i];
            if (tag.is(TagType.AUDIO)) {
                if (tag.audio() === "CBR") {
                    has_cbr = true;
                    pos_cbr = i;
                }
                count_cbr++;
            }

            if (i !== 0 && tag.is(TagType.OTHER) && tag.other() === "BOOTLEG") {
                const prev_delim = _peek(r.tags, i-1, TagType.DELIM) && r.tags[i-1].delim();
                const next_delim = _peek(r.tags, i+1, TagType.DELIM) && r.tags[i+1].delim();
                const wrapped = (prev_delim && prev_delim.endsWith('-') && next_delim && next_delim.startsWith('-')) ||
                                (prev_delim && prev_delim.endsWith('(') && next_delim && next_delim.startsWith(')'));
                if (!wrapped) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                }
            }
            
            const single_ep = tag.singleEp();
            const is_16bit_arch = tag.is(TagType.ARCH) && tag.arch() === "16bit";
            if (music_excl) {
                if (single_ep) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (is_16bit_arch) {
                    r.tags[i] = tag.as(TagType.AUDIO, this.audiof);
                }
            }
        }

        if (has_cbr && count_cbr === 1) {
            r.tags[pos_cbr] = r.tags[pos_cbr].as(TagType.CONTAINER, this.containerf);
        }
    }

    /**
     * Collects all identified tag values and populates the fields of the Release object.
     * @param {Release} r The Release object to populate.
     */
    _collect(r) {
        for (const tag of r.tags) {
            if (tag.is(TagType.PLATFORM) && !r.platform) r.platform = tag.platform();
            else if (tag.is(TagType.ARCH) && !r.arch) r.arch = tag.arch();
            else if (tag.is(TagType.SOURCE)) {
                const s = tag.source();
                if (!r.source || r.source === "CD" || (r.source === "DVD" && s !== "CD")) r.source = s;
            }
            else if (tag.is(TagType.RESOLUTION) && !r.resolution) r.resolution = tag.resolution();
            else if (tag.is(TagType.COLLECTION) && !r.collection) r.collection = tag.collection();
            else if (tag.is(TagType.DATE)) [r.year, r.month, r.day] = tag.date();
            else if (tag.is(TagType.SERIES)) {
                const [series, episode] = tag.series();
                if (r.series === 0) r.series = series;
                if (r.episode === 0) r.episode = episode;
            }
            else if (tag.is(TagType.VERSION) && !r.version) r.version = tag.version();
            else if (tag.is(TagType.DISC) && !r.disc) r.disc = tag.format('s');
            else if (tag.is(TagType.CODEC)) r.codec.push(tag.codec());
            else if (tag.is(TagType.HDR)) r.hdr.push(tag.hdr());
            else if (tag.is(TagType.AUDIO)) r.audio.push(tag.audio());
            else if (tag.is(TagType.CHANNELS) && !r.channels) r.channels = tag.channels();
            else if (tag.is(TagType.OTHER)) r.other.push(tag.other());
            else if (tag.is(TagType.CUT)) r.cut.push(tag.cut());
            else if (tag.is(TagType.EDITION)) r.edition.push(tag.edition());
            else if (tag.is(TagType.LANGUAGE)) r.language.push(tag.language());
            else if (tag.is(TagType.SIZE) && !r.size) r.size = tag.size();
            else if (tag.is(TagType.REGION) && !r.region) r.region = tag.region();
            else if (tag.is(TagType.CONTAINER) && !r.container) r.container = tag.container();
            else if (tag.is(TagType.GENRE) && !r.genre) r.genre = tag.genre();
            else if (tag.is(TagType.ID) && !r.id) r.id = tag.id_();
            else if (tag.is(TagType.GROUP)) r.group = tag.group();
            else if (tag.is(TagType.META)) {
                const [k, v] = tag.meta();
                if (k === "site" && !r.site) r.site = v;
                else if (k === "sum" && !r.sum) r.sum = v;
                else if (k === "pass" && !r.pass_) r.pass_ = v;
                else if (k === "req") r.req = true;
                else r.meta.push(`${k}:${v}`);
            }
            else if (tag.is(TagType.EXT)) r.ext = tag.ext();
        }

        for (let i = r.dates.length - 1; i >= 0; i--) {
            const [year, month, day] = r.tags[r.dates[i]].date();
            if (r.year === 0 && year !== 0) r.year = year;
            if (r.month === 0 && month !== 0) r.month = month;
            if (r.day === 0 && day !== 0) r.day = day;
        }
    }

    /**
     * Inspects the collected tags to guess the release's type (Movie, Music, etc.).
     * @param {Release} r The Release object.
     * @param {boolean} initial A flag to indicate if this is the first inspection pass.
     * @returns {ReleaseType} The guessed release type.
     */
    _inspect(r, initial) {
        if (r.type !== ReleaseType.UNKNOWN) return r.type;

        let app = false, series = false, movie = false;
        for (let i = r.tags.length - 1; i >= 0; i--) {
            const tag = r.tags[i];
            const typ = tag.infoType();
            app = app || typ === ReleaseType.APP;
            series = series || tag.is(TagType.SERIES);
            movie = movie || typ === ReleaseType.MOVIE;

            if ([ReleaseType.BOOK, ReleaseType.GAME].includes(typ)) {
                for (let j = i - 1; j >= 0; j--) {
                    if (ReleaseType.isIn(r.tags[j].infoType(), ReleaseType.COMIC, ReleaseType.EDUCATION, ReleaseType.MAGAZINE)) {
                        return r.tags[j].infoType();
                    }
                }
                return typ;
            }

            if ([ReleaseType.SERIES, ReleaseType.EPISODE].includes(typ)) {
                if (r.episode !== 0 || (r.series === 0 && r.episode === 0 && !r.other.includes("BOXSET"))) {
                    return ReleaseType.EPISODE;
                }
                return ReleaseType.SERIES;
            }

            if (typ === ReleaseType.EDUCATION && r.series === 0 && r.episode === 0) return ReleaseType.EDUCATION;

            if (typ === ReleaseType.MUSIC) {
                for (let j = i - 1; j >= 0; j--) {
                    if (r.tags[j].infoType() === ReleaseType.AUDIOBOOK) return r.tags[j].infoType();
                }
                return typ;
            }

            if ([ReleaseType.AUDIOBOOK, ReleaseType.COMIC, ReleaseType.MAGAZINE].includes(typ)) return typ;

            if (tag.infoExcl() && !r.version && r.series === 0 && r.episode === 0 && r.day === 0 && r.month === 0) return typ;
        }

        let count = 0;
        for (let i = r.tags.length - 2; i > 0; i--) {
            if (r.tags[i].is(TagType.DATE, TagType.CODEC, TagType.HDR, TagType.AUDIO, TagType.RESOLUTION, TagType.SOURCE, TagType.LANGUAGE) &&
                _peek(r.tags, i - 1, TagType.DELIM) && r.tags[i - 1].delim().endsWith('-') &&
                _peek(r.tags, i + 1, TagType.DELIM) && r.tags[i + 1].delim().startsWith('-')) {
                count++;
                if (count > 1) return ReleaseType.MUSIC;
            }
        }

        if (r.episode !== 0 || (r.year !== 0 && r.month !== 0 && r.day !== 0)) return ReleaseType.EPISODE;
        if (r.series !== 0 || series) return ReleaseType.SERIES;
        if (app || (r.version && !r.resolution)) return ReleaseType.APP;
        if (movie || r.resolution) return ReleaseType.MOVIE;
        if ((!r.source || r.source === "WEB") && !r.resolution && r.year !== 0) return ReleaseType.MUSIC;

        if (initial) {
            let reinspect = false;
            for (let i = r.tags.length - 1; i >= 0; i--) {
                if (r.tags[i].was(TagType.PLATFORM, TagType.ARCH)) {
                    r.tags[i] = r.tags[i].revert();
                    reinspect = true;
                    if (r.tags[i].is(TagType.PLATFORM)) r.platform = r.tags[i].platform();
                    else if (r.tags[i].is(TagType.ARCH)) r.arch = r.tags[i].arch();
                }
            }
            if (reinspect) return this._inspect(r, false);
        }

        return ReleaseType.UNKNOWN;
    }

    /**
     * Handles special date parsing, such as finding a month name before a year for magazines.
     * @param {Release} r The Release object.
     */
    _specialDate(r) {
        if (r.type === ReleaseType.MAGAZINE && r.year !== 0 && r.month === 0 && r.day === 0) {
            if (r.dates.length === 0) return;
            let i = r.dates[0] - 1;
            while (i > 0 && r.tags[i].is(TagType.DELIM)) i--;
            if (i >= 0 && r.tags[i].is(TagType.TEXT)) {
                const s = r.tags[i].text();
                try {
                    const monthNum = new Date(Date.parse(s +" 1, 2012")).getMonth() + 1;
                    if (!isNaN(monthNum)) {
                         r.month = monthNum;
                         r.tags[i] = Tag.new(TagType.DATE, null, s, String(r.year), String(r.month), "");
                         r.dates.push(i);
                    }
                } catch (e) { /* ignore */ }
            }
        }
    }

    /**
     * Unsets tags that are exclusive to a different release type. For example, if a release
     * is determined to be a Movie, any Music-exclusive tags are reverted to TEXT.
     * @param {Release} r The Release object.
     */
    _unset(r) {
        const movie_series_episode_music_game = ReleaseType.isIn(r.type, ReleaseType.MOVIE, ReleaseType.SERIES, ReleaseType.EPISODE, ReleaseType.MUSIC, ReleaseType.GAME);
        let grab_source = false;

        for (let i = 0; i < r.tags.length; i++) {
            const tag = r.tags[i];
            if (grab_source && tag.is(TagType.SOURCE) && !r.source) r.source = tag.source();

            const ityp = tag.infoType();
            if (ityp !== r.type && tag.infoExcl() && tag.is(
                TagType.PLATFORM, TagType.ARCH, TagType.SOURCE, TagType.RESOLUTION,
                TagType.COLLECTION, TagType.CODEC, TagType.HDR, TagType.AUDIO,
                TagType.CHANNELS, TagType.OTHER, TagType.CUT, TagType.EDITION,
                TagType.LANGUAGE, TagType.SIZE, TagType.REGION, TagType.CONTAINER,
                TagType.GENRE, TagType.GROUP, TagType.EXT)) {

                const typ = tag.typ;
                const s_norm = tag.normalize();

                if (typ === TagType.PLATFORM && r.platform === s_norm && !r.other.includes("Strategy.Guide")) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.ARCH && r.arch === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.SOURCE && r.source === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.RESOLUTION && r.resolution === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.CODEC && r.codec.includes(s_norm)) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.HDR && r.hdr.includes(s_norm)) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.AUDIO && r.audio.includes(s_norm)) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.CHANNELS && r.channels === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.OTHER && r.other.includes(s_norm)) {
                     r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.CUT && r.cut.includes(s_norm)) {
                     r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.EDITION && r.edition.includes(s_norm)) {
                     r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.LANGUAGE && r.language.includes(s_norm)) {
                     r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.SIZE && r.size === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.REGION && r.region === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.CONTAINER && r.container === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.GENRE && r.genre === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.GROUP && r.group === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                } else if (typ === TagType.EXT && r.ext === s_norm) {
                    r.tags[i] = tag.as(TagType.TEXT, null);
                }
            } else if (!movie_series_episode_music_game && tag.is(TagType.SOURCE) && ReleaseType.isIn(ityp, ReleaseType.MOVIE, ReleaseType.SERIES, ReleaseType.EPISODE)) {
                if (r.source === tag.normalize()) r.source = "";
                r.tags[i] = tag.as(TagType.TEXT, null);
                grab_source = true;
            } else if (!movie_series_episode_music_game && tag.is(TagType.CHANNELS)) {
                r.tags[i] = tag.as(TagType.TEXT, null);
                r.channels = "";
            }
        }

        if (r.version && ReleaseType.isIn(r.type, ReleaseType.MOVIE, ReleaseType.EPISODE, ReleaseType.SERIES)) {
            const is_date_like = r.version.length > 1 && (r.version.substring(1).match(/\./g) || []).length === 2;
            if (is_date_like) {
                for (let i = 0; i < r.tags.length; i++) {
                    const tag = r.tags[i];
                    if (tag.is(TagType.VERSION) && tag.normalize() === r.version) {
                        const date_parts = r.version.match(/\d+/g);
                        if (date_parts && date_parts.length === 3) {
                            const year = `20${date_parts[0]}`;
                            const month = String(parseInt(date_parts[1], 10)).padStart(2, '0');
                            const day = String(parseInt(date_parts[2], 10)).padStart(2, '0');
                            r.tags[i] = Tag.new(TagType.DATE, null, tag.v[0], year, month, day);
                            r.version = "";
                            break;
                        }
                    }
                }
            }
        }
        this._recollectFields(r);
    }

    /**
     * Sets the main title, artist, and subtitle fields based on the release type.
     * @param {Release} r The Release object.
     * @returns {number} The index in the tags array where title parsing stopped.
     */
    _titles(r) {
        let f = this._defaultTitle.bind(this);
        let aka = false;

        if (ReleaseType.isIn(r.type, ReleaseType.MOVIE)) {
            f = this._movieTitles.bind(this); aka = true;
        } else if (ReleaseType.isIn(r.type, ReleaseType.SERIES, ReleaseType.EPISODE)) {
            f = this._episodeTitles.bind(this); aka = true;
        } else if (r.type === ReleaseType.MUSIC) {
            f = this._musicTitles.bind(this);
        } else if (ReleaseType.isIn(r.type, ReleaseType.BOOK, ReleaseType.AUDIOBOOK)) {
            f = this._bookTitles.bind(this);
        } else if (ReleaseType.isIn(r.type, ReleaseType.APP, ReleaseType.GAME)) {
            f = this._appTitle.bind(this);
        }

        const i = f(r);

        if (aka && !r.alt && r.title.includes(" AKA ")) {
            const parts = r.title.split(" AKA ", 2);
            if (parts.length === 2 && parts[0] && parts[1]) {
                [r.title, r.alt] = parts;
            }
        }
        return i;
    }

    /**
     * Sets the title and subtitle for movie releases.
     * @param {Release} r The Release object.
     * @returns {number} The index where title parsing stopped.
     */
    _movieTitles(r) {
        let pos = 0;
        while (pos < r.tags.length && !r.tags[pos].is(TagType.TEXT)) pos++;
        const start = pos;

        const [title, offset] = this._title(r.tags.slice(start), TagType.TEXT);
        r.title = title;

        let datePos = r.tags.findIndex(t => t.is(TagType.DATE));
        if (datePos === -1) return this._boxTitle(r, start, offset);

        let resPos = r.tags.findIndex(t => t.is(TagType.RESOLUTION));
        if (resPos === -1) return this._boxTitle(r, start, offset);

        let hasSubtitle = datePos + 1 < resPos - 1;
        if (!hasSubtitle) return this._boxTitle(r, start, offset);

        for (pos = datePos + 1; pos < resPos; pos++) {
            if (!r.tags[pos].is(TagType.DELIM, TagType.TEXT, TagType.CUT, TagType.EDITION)) {
                hasSubtitle = false;
                break;
            }
        }

        if (hasSubtitle) {
            let subStart = datePos + 1;
            while (subStart < resPos - 1 && !r.tags[subStart].is(TagType.TEXT, TagType.CUT, TagType.EDITION)) {
                subStart++;
            }
            if (subStart < resPos - 1) {
                const [subtitle] = this._title(r.tags.slice(subStart, resPos - 1), TagType.TEXT, TagType.CUT, TagType.EDITION);
                r.subtitle = subtitle;
            }
        }

        if (!r.subtitle && r.title.includes('~')) {
            const parts = r.title.split('~');
            r.title = parts.slice(0, -1).join('~').replace(/[ \t\n\f\r\-._,()\[\]{}~\/\\]+$/, '');
            r.subtitle = parts[parts.length - 1].replace(/^[ \t\n\f\r\-._,()\[\]{}~\/\\]+/, '');
        }

        return Math.min(start + offset, resPos);
    }

    /**
     * Sets the title and subtitle for boxsets, which have a different title structure.
     * @param {Release} r The Release object.
     * @param {number} start The start index for title parsing.
     * @param {number} offset The offset from the initial title parse.
     * @returns {number} The index where title parsing stopped.
     */
    _boxTitle(r, start, offset) {
        const n = start + offset;
        if (n >= r.tags.length || n <= 0 || !r.disc || !r.tags[n].is(TagType.CUT, TagType.EDITION)) {
            return n;
        }

        for (let pos = n - 1; pos > Math.max(start, n - 9, 0); pos--) {
            if (mustNormalize(r.tags[pos - 1].text()) === "the") {
                const [prefix] = this._title(r.tags.slice(pos - 1, n), TagType.TEXT);
                const [suffix, suffixOffset] = this._title(r.tags.slice(n), TagType.TEXT, TagType.CUT, TagType.EDITION);

                r.title = r.title.slice(0, -prefix.length).replace(/[ \t\n\f\r\-._,()\[\]{}~\/\\]+$/, '');
                r.subtitle = `${prefix} ${suffix.replace(/[.\-_]+$/, '')}`;
                return n + suffixOffset;
            }
        }
        return n;
    }

    /**
     * Sets the title and subtitle for series and episode releases.
     * @param {Release} r The Release object.
     * @returns {number} The index where title parsing stopped.
     */
    _episodeTitles(r) {
        let pos = this._movieTitles(r);
        const typ = r.month !== 0 && r.day !== 0 ? TagType.DATE : TagType.SERIES;

        while (pos < r.tags.length && !r.tags[pos].is(typ)) {
            if (r.tags[pos].is(TagType.TEXT)) {
                r.unused.push(pos);
            }
            pos++;
        }

        if (pos === r.tags.length) return pos;
        pos++;

        while (pos < r.tags.length && r.tags[pos].is(
            TagType.DELIM, TagType.SOURCE, TagType.RESOLUTION, TagType.COLLECTION,
            TagType.DATE, TagType.SERIES, TagType.VERSION, TagType.DISC,
            TagType.OTHER, TagType.CUT, TagType.EDITION, TagType.LANGUAGE,
            TagType.CONTAINER)) {
            pos++;
        }

        if (pos === r.tags.length || !r.tags[pos].is(TagType.TEXT)) return pos;

        const [subtitle, offset] = this._title(r.tags.slice(pos), TagType.TEXT);
        r.subtitle = subtitle;
        return pos + offset;
    }

    /**
     * Sets the artist, title, and subtitle for music releases.
     * @param {Release} r The Release object.
     * @returns {number} The index where title parsing stopped.
     */
    _musicTitles(r) {
        let i;
        [r.title, i] = this._mixTitle(r, 0);

        for (const s of [" - ", "--", "~", "-"]) {
            if (r.title.includes(s)) {
                const parts = r.title.split(s);
                r.artist = parts.slice(0, -1).join(s).trim();
                r.title = parts[parts.length - 1].trim();
                break;
            }
        }

        let skipped, ok;
        [i, skipped, ok] = this._checkDate(r, i);
        if (ok) {
            const delim = r.tags[i].delim();
            if (!r.artist && delim.endsWith('(')) {
                const [title, z1] = this._mixTitle(r, i + 1);
                const [subtitle, z2] = this._mixTitle(r, z1 + 1);
                if (title && subtitle) {
                    r.artist = r.title
                    r.title = `(${title}) ${subtitle}`;
                    [i, skipped, ok] = this._checkDate(r, z2);
                    if (!ok) return i;
                }
            }

            if (!r.artist && (skipped || delim.startsWith(')'))) {
                let title, z;
                [title, z] = this._mixTitle(r, i + 1);
                if (title) {
                    r.artist = r.title;
                    r.title = title;
                    i = z;
                }
            }

            if (!r.subtitle && (delim.endsWith('(') || delim === "__" || /[-~]/.test(delim)) &&
                _peek(r.tags.slice(0, r.end), i + 1, TagType.TEXT)) {
                [r.subtitle, i] = this._mixTitle(r, i + 1);
            }
        }

        if (!r.subtitle && r.artist) {
            for (const s of [" - ", "--", "~"]) {
                if (r.artist.includes(s)) {
                    const [new_artist, new_title] = r.artist.split(s);
                    r.artist = new_artist.replace(new RegExp(`[${this.is_title_trim_delim}]+$`), '');
                    r.subtitle = r.title;
                    r.title = new_title.replace(new RegExp(`^[${this.is_break_delim}]+`), '');
                    break;
                }
            }
        }
        return i;
    }

    /**
     * Returns the title of a mix, which may include "REMiX" tags.
     * @param {Release} r The Release object.
     * @param {number} i The starting index.
     * @returns {[string, number]} The mix title and the ending index.
     */
    _mixTitle(r, i) {
        const start_idx = this._textStart(r, i);
        if (start_idx >= r.tags.length) return ["", i];
        let end_idx = start_idx;
        while (end_idx < r.end && r.tags[end_idx].is(TagType.DELIM, TagType.TEXT, TagType.OTHER)) {
            if (r.tags[end_idx].is(TagType.OTHER) && r.tags[end_idx].other() !== "REMiX") break;
            end_idx++;
        }
        const [title, offset] = this._title(r.tags.slice(start_idx, end_idx), TagType.TEXT, TagType.OTHER);
        return [title, start_idx + offset];
    }

    /**
     * Checks if the current position is at the end of tags, and skips a date tag if present.
     * This is useful for parsing formats like `Artist (2003) - Title`.
     * @param {Release} r The Release object.
     * @param {number} i The current index.
     * @returns {[number, boolean, boolean]} The new index, whether a date was skipped, and whether a delimiter was found.
     */
    _checkDate(r, i) {
        if (i >= r.end) return [i, false, false];
        let skipped = false;
        if (r.tags[i].is(TagType.DATE)) {
            i++;
            skipped = true;
        }
        if (i >= r.end || !r.tags[i].is(TagType.DELIM)) {
            return [i, skipped, false];
        }
        return [i, skipped, true];
    }

    /**
     * Sets the artist, title, and subtitle for book and audiobook releases.
     * @param {Release} r The Release object.
     * @returns {number} The index where title parsing stopped.
     */
    _bookTitles(r) {
        let pos = 0, offset = 0;
        while (pos < r.tags.length) {
            let text_pos = pos;
            while (text_pos < r.tags.length && !r.tags[text_pos].is(TagType.TEXT, TagType.PLATFORM, TagType.ARCH, TagType.OTHER, TagType.REGION)) {
                text_pos++;
            }
            if (text_pos >= r.tags.length) break;
            pos = text_pos;

            const tag = r.tags[pos];
            const is_other = tag.is(TagType.OTHER);
            if (is_other && tag.infoType() !== ReleaseType.BOOK) {
                offset = 1; pos += offset; continue;
            }

            let new_s;
            if (is_other && tag.other() === "Strategy.Guide") {
                new_s = tag.text().replace(/\./g, ' '); offset = 2;
            } else {
                [new_s, offset] = this._title(r.tags.slice(pos), TagType.TEXT, TagType.PLATFORM, TagType.ARCH, TagType.REGION);
            }

            if (r.title && new_s) r.title += " ";
            r.title += new_s;
            pos += offset;
        }

        if (r.title.includes(';')) {
            const parts = r.title.split(';');
            const stripEndRegex = new RegExp(`[${this.is_title_trim_delim.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]+$`);
            const stripStartRegex = new RegExp(`^[${this.is_title_trim_delim.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]+`);

            r.title = parts.slice(0, -1).join(';').replace(stripEndRegex, '');
            r.subtitle = parts[parts.length - 1].replace(stripStartRegex, '');		
        }

        if (!r.artist) {
            for (const s_delim of [" - ", "--", "~"]) {
                if (r.title.includes(s_delim)) {
                    const parts = r.title.split(s_delim, 2);
                    r.artist = parts[0].replace(new RegExp(`[${this.is_title_trim_delim}]+$`), '');
                    r.title = parts[1].replace(new RegExp(`^[${this.is_break_delim}]+`), '');
                    break;
                }
            }
        }
        if (!r.subtitle) {
            for (const s_delim of [" - ", "--", "~"]) {
                if (r.title.includes(s_delim)) {
                    const parts = r.title.split(s_delim, 2);
                    r.title = parts[0].replace(new RegExp(`[${this.is_break_delim}]+$`), '');
                    r.subtitle = parts[1].replace(new RegExp(`^[${this.is_title_trim_delim}]+`), '');
                    break;
                }
            }
        }
        if (!r.artist && r.title.includes('-')) {
            const parts = r.title.split('-');
            const artist = parts.slice(0,-1).join('-').replace(new RegExp(`[${this.is_title_trim_delim}]+$`), '');
            const title = parts[parts.length-1].replace(new RegExp(`^[${this.is_break_delim}]+`), '');
            if (!this.digsuf_re.test(artist) && !this.digpre_re.test(title)) {
                r.artist = artist; r.title = title;
            }
        }
        return pos;
    }

    /**
     * Sets the title for an application or game release.
     * @param {Release} r The Release object.
     * @returns {number} The index where title parsing stopped.
     */
    _appTitle(r) {
        let pos = 0;
        while (pos < r.tags.length && !r.tags[pos].is(TagType.TEXT, TagType.DATE)) pos++;
        const [title, offset] = this._title(r.tags.slice(pos), TagType.TEXT, TagType.DATE);
        r.title = title;
        return pos + offset;
    }

    /**
     * Sets a default title by consuming all initial text tags.
     * @param {Release} r The Release object.
     * @returns {number} The index where title parsing stopped.
     */
    _defaultTitle(r) {
        let pos = 0;
        while (pos < r.tags.length && !r.tags[pos].is(TagType.TEXT)) pos++;
        const [title, offset] = this._title(r.tags.slice(pos), TagType.TEXT);
        r.title = title;
        return pos + offset;
    }

    /**
     * Finds all text in a sequence of tags, stopping at a non-space delimiter,
     * and returns the combined title and ending position. This function also handles
     * fixing acronyms and cleaning up the final title string.
     * @param {Tag[]} tags The tags to process.
     * @param {...TagType} types The tag types to consider as part of the title.
     * @returns {[string, number]} The resulting title and the final index.
     */
    _title(tags, ...types) {
        const v = [];
        let i = 0;
        while (i < tags.length) {
            const tag = tags[i];
            if (tag.is(...types)) {
                v.push(tag.textReplace('.', ' '));
            } else if (tag.is(TagType.DELIM)) {
                const s = tag.delim();
                if (!/[()\[\]{}\/]/.test(s) && s !== "__") {
                    v.push(this._delimText(s, tags, i, ...types));
                } else break;
            } else break;
            i++;
        }


        let s = v.join('');
        s = s.replace(this.missing_re, (m) => m.trim().replace(/ /g, ".") + ". ");
        s = s.replace(". .", ". ");
        s = s.replace(this.bad_re, (m) => m.replace(this.fix_re, '$1'));
        s = s.replace(this.spaces_re, " ");
        s = s.replace(this.ellips_re, "...");

        s = he.decode(s);	    
        if ((s.match(this.plus_re) || []).length > 1) {
            s = s.replace(this.plus_re, " ");
        }

        const stripRegex = /^[ \t\n\f\r()\[\]{}~\/\\_,-]+|[ \t\n\f\r()\[\]{}~\/\\_,-]+$/g;
        return [s.replace(stripRegex, ''), i];
    }

    /**
     * Determines the text representation of a delimiter based on its surrounding tags.
     * For example, a period between two uppercase letters is kept as a period for an acronym.
     * @param {string} delim The delimiter string.
     * @param {Tag[]} tags The full list of tags for context.
     * @param {number} i The index of the delimiter tag.
     * @param {...TagType} types The types considered as title text.
     * @returns {string} The processed delimiter text (e.g., ".", " ", or "-").
     */
    _delimText(delim, tags, i, ...types) {
        if (delim === "..." || delim === ".." || delim === ". ") {
            return delim === "..." ? "..." : ". ";
        }
        if (!delim) return " ";
        let s = [...delim].map(c => "-+,.~".includes(c) ? c : ' ').join('').replace(this.spaces_re, ' ');
        if (s !== "." || i === tags.length - 1) {
            return s.replace(/\./g, ' ').replace(this.spaces_re, ' ');
        }

        const ante = i > 1 && tags[i - 2].is(TagType.DELIM) ? tags[i - 2].delim() : "";
        const prev = i > 0 && tags[i - 1].is(...types) ? tags[i - 1].text() : "";
        const next_text = i < tags.length - 1 && tags[i + 1].is(...types) ? tags[i + 1].text() : "";

        if (isUpperLetter(prev) && isUpperLetter(next_text) && !/[-~]/.test(ante)) return ".";
        if (isDigit(prev) && isDigit(next_text) && !/[-~]/.test(ante)) return ".";
        return " ";
    }

    /**
     * Collects any remaining text tags as "unused" and performs final conversions,
     * such as identifying a checksum or a release group from the last text tag.
     * @param {Release} r The Release object.
     * @param {number} i The index to start searching for unused tags from.
     */
    _unused(r, i) {
        for (let j = i; j < r.tags.length; j++) {
            if (r.tags[j].is(TagType.TEXT)) {
                r.unused.push(j);
            }
        }
        if (r.unused.length > 0) {
            const last_unused_idx = r.unused[r.unused.length - 1];
            const s = r.tags[last_unused_idx].text();

            if (!r.sum && this.sum_re.test(s) && /\d/.test(s)) {
                r.sum = s;
                r.unused.pop();
            } else if (!r.group && !this.digits_re.test(s)) {
                r.group = s;
                r.unused.pop();
            }
        }
    }
}

/**
 * The main parser for release strings. It orchestrates the lexing process
 * and uses a TagBuilder to construct the final Release object.
 */
class TagParser {
    /**
     * Creates a new release tag parser.
     * This constructor sets up all the lexers and regular expressions needed for parsing.
     * @param {Object<string, TagInfo[]>} infos A map of all tag information.
     * @param {(() => Lexer)[]} lexerTypes An array of lexer factory functions.
     */
    constructor(infos, lexerTypes) {
        this.builder = new TagBuilder().initialize(infos);
        const v = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).filter(isAnyDelim);
        const delim_re_str = `^((?:${_reutil_join(v, true)})+)`;
        this.delim_re = new RegExp(delim_re_str);
        this.whitespace_re = /^[\t\n\f\r]+/;
        this.ellip = "...";
        this.work_re = /[_,\+]/g;

        /** @type {Object<string, boolean>} */
        this.short_map = {};
        const excluded_types = new Set([
            Object.keys(TagType).find(k => TagType[k] === TagType.HDR).toLowerCase(),
            Object.keys(TagType).find(k => TagType[k] === TagType.LANGUAGE).toLowerCase()
        ]);
        for (const type in infos) {
            if (excluded_types.has(type)) continue;		
            for (const info of infos[type]) {
                for (const field of info.tag.split(/[\t\n\f\r ()+,\-._/\\\[\]{}~]/)) {
                    if (field.length > 0 && field.length < 5 && !field.includes('$')) {
                        this.short_map[field.toUpperCase()] = true;
                    }
                }
            }
        }

        /** @type {LexFunc[]} */
        this.once_lexers = [];
        /** @type {LexFunc[]} */
        this.multi_lexers = [];
        /** @type {boolean[]} */
        this.not_first_flags = [];

        for (const LClass of lexerTypes) {
            const lexer = LClass();
            const lex_func = lexer.initialize(this, infos, this.delim_re);
            if (lexer.once) {
                this.once_lexers.push({
                    name: LClass.name || lexer.constructor.name,
                    func: lex_func
                });		    
            } else {
                this.multi_lexers.push({
                    name: LClass.name || lexer.constructor.name,
                    func: lex_func,
                    notFirst: lexer.notFirst
                });		    
            }
        }
    }

    /**
     * Sets the builder for the tag parser.
     * @param {TagBuilder} builder The builder instance to use.
     */
    setBuilder(builder) {
        this.builder = builder;
    }

    /**
     * Parses tags from a source string.
     * @param {string} src The source string to parse.
     * @returns {[Tag[], number]} A tuple containing the array of parsed tags and the index separating start tags from end tags.
     */
    parse(src) {
        const buf = src.replace(this.work_re, ' ');
        let i = 0, n = buf.length;
        /** @type {Tag[]} */
        let start_tags = [];
        /** @type {Tag[]} */
        let end_tags = [];

        for (const { name: lexerName, func: f } of this.once_lexers) {	    
            let res = f(this, src, buf, start_tags, end_tags, i, n);
            [start_tags, end_tags, i, n] = res;		

            if (!Array.isArray(end_tags)) {
                console.error(`[FATAL] Lexer ${lexerName} returned a non-array for end_tags! Value:`, end_tags);
                throw new Error(`Lexer ${lexerName} returned non-iterable end_tags`);
            }
        }

        let not_first = false;
        while (i < n) {
            [start_tags, end_tags, i, n, not_first] = this._next(src, buf, start_tags, end_tags, i, n, not_first);
        }

        const tags = [...start_tags, ...end_tags];
        return [tags, start_tags.length];
    }

    /**
     * Reads the next token from src up to the next delimiter. Iterates over
     * the lexers until a match occurs. If none of the lexers match, then iterates
     * over src, capturing all text, until src is exhausted or until a delimiter is
     * encountered. Appends captured tags to start or end (where appropriate)
     * returning the modified arrays and new values of i, n.
     *
     * Lexers have the choice of matching against src or buf. Buf is the working
     * version of src, with underscores and other characters replaced with spaces. Using
     * buf allows lexers to match with word boundaries (`\b`).
     * @private
     */
    _next(src, buf, start, end, i, n, not_first) {
        if (src.substring(i, n).startsWith(this.ellip)) {
            start.push(Tag.new(TagType.DELIM, null, this.ellip, this.ellip));
            return [start, end, i + this.ellip.length, n, not_first];		
        }

        const m = src.substring(i, n).match(this.delim_re);
        if (m) {
            start.push(Tag.new(TagType.DELIM, null, m[0], m[1]));
            return [start, end, i + m[0].length, n, not_first];
        }

        const start_n = start.length;
        for (const { name: lexerName, func: f, notFirst: lexerNotFirst } of this.multi_lexers) {
            if (lexerNotFirst && !not_first) continue;	    
            

            const current_start_len = start.length;		
            const [s, e, new_i, new_n, ok] = f(this, src, buf, start, end, i, n);			

            if (!Array.isArray(e)) {
                console.error(`[FATAL] Lexer returned a non-array for end_tags! Value:`, e);
                throw new Error(`Lexer returned non-iterable end_tags`);
            }

            if (ok) {
                const added_tags = s.slice(current_start_len);
                not_first = not_first || start_n !== s.length;
                return [s, e, new_i, new_n, not_first];
            }
        }

        let j = i;
        while (j < n) {
            if (this.delim_re.test(src.substring(j))) break;
            j++;
        }

        start.push(Tag.new(TagType.TEXT, null, src.substring(i, j), src.substring(i, j)));	    
        not_first = true;
        return [start, end, j, n, not_first];
    }

    /**
     * Parses a full Release object from a source string.
     * @param {string} src The source string.
     * @param {boolean} [typeOnly=false] If true, performs a faster parse to only determine the type.
     * @returns {Release} The parsed Release object.
     */
    /**
     * Parses a full Release object from a source string.
     * @param {string} src The source string.
     * @param {boolean} [typeOnly=false] If true, performs a faster parse to only determine the type.
     * @returns {object} The parsed Release object, formatted as a plain object.
     */
    parseRelease(src, typeOnly = false) {
        const [tags, endIndex] = this.parse(src);
        if (typeOnly) {
            return this.builder.buildTypeOnly(tags, endIndex);
        }
        const r = this.builder.build(tags, endIndex);

        const seriesEpisodes = r.seriesEpisodes();

        return {
            type: r.type,
            artist: r.artist,
            title: r.title,
            subtitle: r.subtitle,
            alt: r.alt,
            platform: r.platform,
            arch: r.arch,
            source: r.source,
            resolution: r.resolution,
            collection: r.collection,
            year: r.year,
            month: r.month,
            day: r.day,
            series: r.series,
            episode: r.episode,
            seriesEpisodes: seriesEpisodes.length > 1 ?
                seriesEpisodes.map(ep => `S${String(ep[0]).padStart(2, '0')}E${String(ep[1]).padStart(2, '0')}`).join(' ') :
                "",
            version: r.version,
            disc: r.disc,
            codec: r.codec.join(' '),
            hdr: r.hdr.join(' '),
            audio: r.audio.join(' '),
            channels: r.channels,
            other: r.other.join(' '),
            cut: r.cut.join(' '),
            edition: r.edition.join(' '),
            language: r.language.join(' '),
            size: r.size,
            region: r.region,
            container: r.container,
            genre: r.genre,
            id: r.id,
            group: r.group,
            meta: r.meta.join(' '),
            site: r.site,
            sum: r.sum,
            pass: r.pass_,
            req: r.req ? 1 : 0,
            ext: r.ext,
            unused: r.getUnused().map(tag => tag.format('s')).join(' '),
        };
    }	
}


// ----------------------------------------------------------------------
// 8. Main Library Interface (Exported)
// ----------------------------------------------------------------------

// Create a single, shared instance of the sorted tag info.
// This is computed only once when the module is first required.
const ALL_TAG_INFOS = _loadTagInfoFromCsv(TAGINFO_CSV_DATA);

// Add hardcoded groups (with hyphens, etc.) to the main configuration.
// This ensures they are recognized by the GroupLexer before its fallback logic is triggered.
const extraGroupInfo = _getHardcodedGroups();
if (!ALL_TAG_INFOS.group) { ALL_TAG_INFOS.group = []; }
ALL_TAG_INFOS.group.push(...extraGroupInfo.group);

/**
 * The main Rls class.
 * Instantiate this once and use its methods to parse release strings.
 */
class Rls {
    /**
     * Creates an Rls parser instance.
     * The heavy work of loading and preparing parsing rules is done only once
     * when the module is loaded, so creating new instances is cheap.
     */
    constructor() {
        /**
         * @private
         * @type {TagParser}
         */
        this.parser = new TagParser(ALL_TAG_INFOS, defaultLexerTypes());
    }

    /**
     * Parses a release string into its component parts.
     *
     * @param {string} src The release string to parse.
     * @param {object} [options={}] Parsing options.
     * @param {boolean} [options.typeOnly=false] If true, performs a faster parse that only determines the release type, returning a partially filled Release object.
     * @returns {Release} The parsed release object.
     */
    parseRelease(src, { typeOnly = false } = {}) {
        return this.parser.parseRelease(src, typeOnly);
    }
}

module.exports = {
    Rls,
    Release,
    Tag,
    ReleaseType,
    TagType,
};

