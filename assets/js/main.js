'use strict';
const tabs = ['home','bookings','contact','settings'];
function openTab(tab, push=true){
  if(!tabs.includes(tab)) tab='home';
  document.querySelectorAll('.tab-panel').forEach(p=>{const selected=p.id===tab;p.classList.toggle('active',selected);p.hidden=!selected;});
  document.querySelectorAll('[data-tab]').forEach(b=>{
    const selected=b.dataset.tab===tab;b.classList.toggle('active',selected);
    if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  if(push&&location.hash!==`#${tab}`)history.pushState(null,'',`#${tab}`);
  window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));
document.querySelectorAll('[data-tab-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openTab(a.dataset.tabLink)}));
window.addEventListener('hashchange',()=>openTab(location.hash.slice(1),false));
openTab(location.hash.slice(1),false);
const detailDialog=document.querySelector('#detail-dialog');
const details={cleaning:{title:'Nyamatsi Cleaning',description:'We manufacture household cleaning chemicals and industrial chemicals. Request a cleaning service using the Bookings section.',image:'assets/img/cleaning_chemicals.png',service:'Cleaning'},construction:{title:'Nyamatsi Construction',description:'We manufacture, supply and apply gamazine plaster paint. Request a construction service using the Bookings section.',image:'assets/img/house_painting.png',service:'Construction'}};
let selectedService='Cleaning';
document.querySelectorAll('[data-service-detail]').forEach(b=>b.addEventListener('click',()=>{const d=details[b.dataset.serviceDetail];selectedService=d.service;document.querySelector('#dialog-heading').textContent=d.title;document.querySelector('#dialog-description').textContent=d.description;document.querySelector('#dialog-image').src=d.image;detailDialog.showModal();}));
document.querySelector('#dialog-book').addEventListener('click',()=>{detailDialog.close();openTab('bookings');document.querySelector('#book-service').value=selectedService;});
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
const infoDialog=document.querySelector('#info-dialog');
function inform(title,description){document.querySelector('#info-heading').textContent=title;document.querySelector('#info-description').textContent=description;infoDialog.showModal();}
const today=new Date();const localDate=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);document.querySelector('#book-date').min=localDate;
document.querySelector('#booking-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;inform('Booking integration is next','Your form is ready, but it has not submitted a booking. We will connect the website to the same Firebase Authentication and Firestore project as your Android app in Phase 2.');document.querySelector('#booking-feedback').textContent='Preview only — no booking was saved.';});
document.querySelector('#profile-form').addEventListener('submit',e=>{e.preventDefault();inform('Profile saving comes next','This is the Android-matching Settings interface. No account details have been saved; Firebase integration is pending.');});
document.querySelector('#password-button').addEventListener('click',()=>inform('Change Password','This feature will be connected to Firebase Authentication in Phase 2.'));
document.querySelector('#sign-in-button').addEventListener('click',()=>inform('Sign In / Register','Firebase Authentication will be added in Phase 2 so your website and Android app can use the same account.'));
document.querySelector('#help-button').addEventListener('click',()=>inform('Help and Support','For assistance, use the Contact tab to reach Nyamatsi Holdings by WhatsApp, phone, email or TikTok.'));
const preference=document.querySelector('#notice-toggle');try{const stored=localStorage.getItem('nyamatsi-notice-preference');if(stored!==null)preference.checked=stored==='true';preference.addEventListener('change',()=>localStorage.setItem('nyamatsi-notice-preference',String(preference.checked)));}catch(_error){}
