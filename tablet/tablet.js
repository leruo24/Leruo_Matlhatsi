const p=window.PORTFOLIO;
function element(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;}
function link(label,url){const a=element('a',label);a.href=url;if(url.startsWith('http')){a.target='_blank';a.rel='noopener noreferrer';}return a;}
document.querySelector('#tagline').textContent=p.tagline;
for(const project of p.projects.filter(project=>project.id!=='portfolio')){
 const article=element('article',null,'project');article.id=project.id;
 article.append(element('p',project.year+' / '+project.subtitle,'meta'),element('h3',project.name),element('p',project.summary));
 const tags=element('div',null,'tags');project.tags.forEach(t=>tags.append(element('span',t,'tag')));article.append(tags);
 const details=element('details');details.append(element('summary','My contribution'),element('p',project.role));
 const list=element('ul');project.points.forEach(point=>list.append(element('li',point)));details.append(list);
 project.links.forEach(l=>details.append(link(l.label,l.url)));article.append(details);document.querySelector('#project-list').append(article);
}
p.about.forEach(text=>document.querySelector('#bio').append(element('p',text)));
p.skills.forEach(group=>{const section=element('div');section.append(element('h3',group.group),element('p',group.items.join(' · ')));document.querySelector('#skills').append(section);});
document.querySelector('#links').append(link('Email Leruo','mailto:'+p.contact.email),link('LinkedIn',p.contact.linkedin),link('GitHub',p.contact.github));
