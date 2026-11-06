(function(){
  var head=document.querySelector('.site-head');
  var onScroll=function(){head&&head.classList.toggle('scrolled',window.scrollY>8)};
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  var burger=document.querySelector('.burger');
  if(burger){burger.addEventListener('click',function(){
    var open=document.body.classList.toggle('nav-open');burger.setAttribute('aria-expanded',open);
  });
  document.querySelectorAll('.nav a').forEach(function(a){a.addEventListener('click',function(){document.body.classList.remove('nav-open');burger.setAttribute('aria-expanded',false)})});}

  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reveal on scroll
  if('IntersectionObserver' in window && !reduce){
    var ro=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');ro.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ro.observe(el)});
  } else document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in')});

  // «Собери · Разбери» video cards
  var cards=[].slice.call(document.querySelectorAll('.vcard'));
  cards.forEach(function(card){
    var v=card.querySelector('video'),btns=card.querySelectorAll('.seg button'),pp=card.querySelector('.vplay');
    if(reduce)card.classList.add('paused');
    btns.forEach(function(b){b.addEventListener('click',function(){
      if(b.getAttribute('aria-pressed')==='true')return;
      btns.forEach(function(x){x.setAttribute('aria-pressed',x===b)});
      v.poster=b.dataset.poster;v.src=b.dataset.src;v.load();
      card.classList.remove('paused');var p=v.play();if(p&&p.catch)p.catch(function(){});
    })});
    pp.addEventListener('click',function(){
      if(v.paused){card.classList.remove('paused');v.play()}else{card.classList.add('paused');v.pause()}
    });
  });
  if('IntersectionObserver' in window){
    var vo=new IntersectionObserver(function(es){es.forEach(function(e){
      var card=e.target,v=card.querySelector('video');
      if(e.isIntersecting){
        if(!v.src){v.src=v.dataset.src;v.load()}
        if(!card.classList.contains('paused')){var p=v.play();if(p&&p.catch)p.catch(function(){})}
      } else if(v.src){v.pause()}
    })},{threshold:.35});
    cards.forEach(function(c){vo.observe(c)});
  } else cards.forEach(function(c){var v=c.querySelector('video');v.src=v.dataset.src});
})();
