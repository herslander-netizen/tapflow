export function videoForItem(item){
  const v=item?.video;
  if(!v||typeof v.src!=="string"||!["video/mp4","video/webm"].includes(v.type))return null;
  try{
    const url=new URL(v.src);
    if(url.protocol!=="https:"||url.username||url.password)return null;
    return {src:url.href,type:v.type,page:v.page||"",author:v.author||"",license:v.license||""};
  }catch{return null;}
}
export function canAutoplay({reducedMotion=false,saveData=false,hidden=false}={}){
  return !reducedMotion&&!saveData&&!hidden;
}
