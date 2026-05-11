import{jsx as _jsx}from"react/jsx-runtime";import{addPropertyControls,ControlType,RenderTarget,withCSS,clampRGB}from"framer";import{motion}from"framer-motion";import Player from"@vimeo/player";import{useEffect,useRef,useState}from"react";import{useRadius,borderRadiusControl}from"https://framer.com/m/framer/default-utils.js@^0.45.0";const vimeoRegex=/^https?:\/\/vimeo\.com\/(\d+)/;/**
 * VIMEO
 *
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 270
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 *
 * @framerComponentPresetProps borderRadius, backgroundColor
 */const Vimeo=withCSS(function Vimeo({video,autoplay,mute,controls,loop,titles,backgroundColor,onPlay=()=>{},onEnd=()=>{},style,...props}){const[key,setKey]=useState(0);const player=useRef();const borderRadius=useRadius(props);useEffect(()=>{if(!player.current)return;const[,id]=video.match(vimeoRegex)?video.match(vimeoRegex):[null,0];const embeddedPlayer=new Player(player.current,{id,autopause:false,autoplay:RenderTarget.current()===RenderTarget.canvas?false:autoplay,byline:titles,controls:controls,loop:loop,title:titles,muted:mute,responsive:true});embeddedPlayer.on("play",onPlay);embeddedPlayer.on("ended",onEnd);},[player,key]);useEffect(()=>{setKey(key=>key+1);},[video,autoplay,mute,controls,loop,titles]);return /*#__PURE__*/_jsx(motion.div,{style:{"--background-rgb":clampRGB(backgroundColor),background:`var(--vimeo-background, ${backgroundColor})`,...style,borderRadius,position:"relative",width:"100%",height:"100%",display:"flex",justifyContent:"center",alignItems:"center",overflow:"hidden"},...props,children:/*#__PURE__*/_jsx("div",{className:"framer-vimeo",ref:player,style:{width:"100%",height:"100%"}},key)});},[".framer-vimeo > div { padding: 0 !important; width: 100%; height: 100%; }","@supports not (color: color(display-p3 1 1 1)) { :root { --vimeo-background: var(--background-rgb)}}"],"framer-lib-vimeo");Vimeo.defaultProps={video:"https://vimeo.com/642263700",autoplay:false,loop:false,mute:false,backgroundColor:"rgba(0, 0, 0, 0)",borderRadius:0};addPropertyControls(Vimeo,{video:{title:"URL",type:ControlType.String},...borderRadiusControl,controls:{title:"Controls",type:ControlType.Boolean,enabledTitle:"Show",disabledTitle:"Hide"},autoplay:{title:"Autoplay",type:ControlType.Boolean,enabledTitle:"Yes",disabledTitle:"No"},// playOnCanvas: {
//     title: "On Canvas",
//     type: ControlType.Boolean,
//     enabledTitle: "Play",
//     disabledTitle: "Pause",
// },
loop:{title:"Loop",type:ControlType.Boolean,enabledTitle:"Yes",disabledTitle:"No"},mute:{title:"Mute",type:ControlType.Boolean,enabledTitle:"Yes",disabledTitle:"No"},// titles: {
//     title: "Titles",
//     type: ControlType.Boolean,
//     enabledTitle: "Show",
//     disabledTitle: "Hide",
// },
backgroundColor:{type:ControlType.Color,title:"Background",defaultValue:"rgba(0, 0, 0, 0)"},onPlay:{type:ControlType.EventHandler},onEnd:{type:ControlType.EventHandler}});export default Vimeo;
export const __FramerMetadata__ = {"exports":{"default":{"type":"reactComponent","name":"Vimeo","slots":[],"annotations":{"framerSupportedLayoutHeight":"fixed","framerIntrinsicWidth":"480","framerComponentPresetProps":"borderRadius, backgroundColor","framerSupportedLayoutWidth":"fixed","framerContractVersion":"1","framerIntrinsicHeight":"270"}},"__FramerMetadata__":{"type":"variable"}}}
//# sourceMappingURL=./Vimeo.map