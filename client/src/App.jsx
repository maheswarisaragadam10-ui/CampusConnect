import React, { useEffect, useState } from "react";
import { Routes, Route, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight, Bell, BookOpen, CalendarDays, CheckCircle2, ChevronRight,
  CircleUserRound, ClipboardList, Heart, Home, Leaf, LogIn, LogOut, Menu,
  MessageCircle, Package, Search, ShieldCheck, ShoppingBag, Sparkles, Tag,
  Users, X, MapPin, Clock, Plus, AlertTriangle, GraduationCap
} from "lucide-react";

const api = async (url, options={}) => {
  const token = localStorage.getItem("cc_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
};

const categories = ["Books","Furniture","Electronics","Stationery","Bicycles","Clothing","Other"];

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cc_token");
    if (!token) return setLoading(false);
    api("/api/auth/me").then(d => setUser(d.user)).catch(() => localStorage.removeItem("cc_token")).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="screen-loader"><div className="spinner"></div><p>Loading CampusConnect…</p></div>;

  return (
    <div className="app-shell">
      <Navbar user={user} setUser={setUser} />
      <main>
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/marketplace" element={<Marketplace user={user} />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/clubs" element={<Clubs user={user} />} />
          <Route path="/events" element={<Events user={user} />} />
          <Route path="/lost-found" element={<LostFound user={user} />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/admin" element={<AdminPanel user={user} />} />
          <Route path="/login" element={<Auth mode="login" setUser={setUser} />} />
          <Route path="/register" element={<Auth mode="register" setUser={setUser} />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function Navbar({user,setUser}) {
  const [open,setOpen] = useState(false);
  const navigate = useNavigate();
  const links = [
    ["Home","/"],["Marketplace","/marketplace"],["Announcements","/announcements"],
    ["Clubs","/clubs"],["Events","/events"],["Lost & Found","/lost-found"]
  ];
  const logout = () => {
    localStorage.removeItem("cc_token");
    setUser(null);
    navigate("/");
  };
  return <header className="navbar">
    <div className="container nav-inner">
      <Link className="brand" to="/" onClick={()=>setOpen(false)}>
        <span className="brand-mark"><Leaf size={20}/></span>
        <span>Campus<span>Connect</span></span>
      </Link>
      <button className="mobile-menu" onClick={()=>setOpen(!open)} aria-label="Toggle menu">{open?<X/>:<Menu/>}</button>
      <nav className={`nav-links ${open?"open":""}`}>
        {links.map(([label,path])=><NavLink key={path} to={path} end={path==="/"} onClick={()=>setOpen(false)}>{label}</NavLink>)}
        {user ? <>
  <NavLink to="/dashboard" onClick={()=>setOpen(false)}>
    <CircleUserRound size={17}/> Dashboard
  </NavLink>

  {user.role === "admin" && (
    <NavLink to="/admin" onClick={()=>setOpen(false)}>
      <ShieldCheck size={17}/> Admin
    </NavLink>
  )}

  <button className="nav-login secondary" onClick={logout}>
    <LogOut size={16}/> Logout
  </button>
</> : <>
          <NavLink className="nav-login secondary" to="/login" onClick={()=>setOpen(false)}>Login</NavLink>
          <NavLink className="nav-login primary" to="/register" onClick={()=>setOpen(false)}>Sign Up</NavLink>
        </>}
      </nav>
    </div>
  </header>
}

function HomePage({user}) {
  const [stats,setStats] = useState({itemsReused:0,studentsConnected:0,eventsHosted:0,recoveredItems:0});
  const [ann,setAnn] = useState([]);
  const [items,setItems] = useState([]);
  const [events,setEvents] = useState([]);
  useEffect(()=>{ Promise.all([api("/api/stats"),api("/api/announcements"),api("/api/items"),api("/api/events")]).then(([s,a,i,e])=>{setStats(s);setAnn(a.slice(0,3));setItems(i.slice(0,4));setEvents(e.slice(0,3));}); },[]);
  return <Page>
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <div className="eyebrow"><Sparkles size={16}/> One campus. One community.</div>
          <h1>Connect, Exchange, and <span>Engage</span> with Your Campus</h1>
          <p>CampusConnect brings students, reusable items, campus updates, clubs, events, and Lost & Found together in one platform.</p>
          <div className="hero-actions">
            <Link className="btn primary" to="/marketplace">Explore CampusConnect <ArrowRight size={18}/></Link>
            <Link className="btn outline" to={user?"/dashboard":"/register"}>{user?"Open Dashboard":"Join the Community"}</Link>
          </div>
          <div className="trust-row"><ShieldCheck size={18}/> Built for student communities <span>•</span> Sustainable by design</div>
        </div>
        <div className="hero-art">
          <div className="art-circle"></div>
          <div className="student-card card-float one"><div className="avatar">👩‍🎓</div><div><b>Priya</b><small>Exchanged a textbook</small></div><CheckCircle2 size={20}/></div>
          <div className="student-card card-float two"><div className="avatar">👨‍💻</div><div><b>Arjun</b><small>Joined CodeCraft</small></div><Users size={20}/></div>
          <div className="hero-main-card"><div className="hero-emoji">🌱</div><h3>Give items a second life</h3><p>Reuse more. Connect better.</p><div className="mini-progress"><span></span></div><small>1,284+ items reused</small></div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionTitle eyebrow="Everything in one place" title="Quick access" text="Get to the campus services you use most."/>
        <div className="quick-grid">
          <Quick icon={<Package/>} title="Exchange Items" text="Give useful items a second life." to="/marketplace"/>
          <Quick icon={<Bell/>} title="Announcements" text="Never miss important campus updates." to="/announcements"/>
          <Quick icon={<Users/>} title="Join Clubs" text="Find communities that match your interests." to="/clubs"/>
          <Quick icon={<CalendarDays/>} title="Discover Events" text="Explore and register for campus activities." to="/events"/>
          <Quick icon={<Search/>} title="Lost & Found" text="Help reunite students with their belongings." to="/lost-found"/>
        </div>
      </div>
    </section>

    <section className="section tinted">
      <div className="container">
        <SectionTitle eyebrow="Stay informed" title="Latest announcements" link="/announcements"/>
        <div className="three-grid">{ann.map(a=><AnnouncementCard key={a.id} a={a}/>)}</div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionTitle eyebrow="Sustainable marketplace" title="Featured items" link="/marketplace"/>
        <div className="four-grid">{items.map(i=><ItemCard key={i.id} item={i}/>)}</div>
      </div>
    </section>

    <section className="section tinted">
      <div className="container">
        <SectionTitle eyebrow="What's happening" title="Upcoming events" link="/events"/>
        <div className="three-grid">{events.map(e=><EventCard key={e.id} event={e}/>)}</div>
      </div>
    </section>

    <section className="section sustainability">
      <div className="container">
        <div className="sustain-grid">
          <div><div className="eyebrow green"><Leaf size={16}/> Sustainability</div><h2>Give Items a Second Life</h2><p>Students buy, exchange, donate and reuse everyday items instead of letting useful things become waste. Every exchange can save money, reduce waste, and strengthen campus community.</p><Link className="btn primary" to="/marketplace">Start Reusing <ArrowRight size={18}/></Link></div>
          <div className="stats-grid">
            <Stat n={stats.itemsReused} label="Items reused" suffix="+"/>
            <Stat n={stats.studentsConnected} label="Students connected" suffix="+"/>
            <Stat n={stats.eventsHosted} label="Events hosted" suffix="+"/>
            <Stat n={stats.recoveredItems} label="Items recovered" suffix="+"/>
          </div>
        </div>
      </div>
    </section>
  </Page>
}

function Quick({icon,title,text,to}){return <Link className="quick-card" to={to}><div className="icon-box">{icon}</div><div><h3>{title}</h3><p>{text}</p></div><ChevronRight/></Link>}
function Stat({n,label,suffix=""}){return <div className="stat-card"><strong>{n}{suffix}</strong><span>{label}</span></div>}
function SectionTitle({eyebrow,title,text,link}){return <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{text&&<p>{text}</p>}</div>{link&&<Link className="text-link" to={link}>View all <ArrowRight size={16}/></Link>}</div>}

function Marketplace({user}) {
  const [items,setItems]=useState([]), [q,setQ]=useState(""), [filter,setFilter]=useState(""), [modal,setModal]=useState(false), [msg,setMsg]=useState("");
  const load=()=>api(`/api/items?search=${encodeURIComponent(q)}&category=${encodeURIComponent(filter)}`).then(setItems);
  useEffect(()=>{load()},[filter]);
  const save = async id => {
    if(!user) return setMsg("Please log in to save items.");
    try { await api(`/api/items/${id}/save`,{method:"POST"}); setMsg("Saved status updated."); } catch(e){setMsg(e.message)}
  };
  return <Page>
    <PageHero icon={<ShoppingBag/>} title="Marketplace" text="Exchange, donate, or give useful campus items a second life." action={user?<button className="btn primary" onClick={()=>setModal(true)}><Plus size={18}/> Post an Item</button>:<Link className="btn primary" to="/login">Login to Post</Link>}/>
    <section className="section"><div className="container">
      <div className="filters"><div className="search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search items…"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select><button className="btn outline" onClick={load}>Search</button></div>
      {msg&&<div className="notice">{msg}</div>}
      <div className="four-grid">{items.map(i=><ItemCard key={i.id} item={i} onSave={()=>save(i.id)}/>)}</div>
      {!items.length&&<Empty title="No items found" text="Try a different search or post the first item."/>}
    </div></section>
    {modal&&<ItemModal onClose={()=>setModal(false)} onCreated={()=>{setModal(false);load();}}/>}
  </Page>
}

function ItemCard({item,onSave}){return <article className="item-card card"><div className="item-image">{item.image||"📦"}<span className="pill">{item.exchange_type}</span></div><div className="card-body"><div className="card-top"><span className="category">{item.category}</span><button className="icon-btn" onClick={onSave} title="Save"><Heart size={17}/></button></div><h3>{item.name}</h3><p>{item.description}</p><div className="meta"><span><Tag size={14}/>{item.condition}</span><span><MapPin size={14}/>{item.location}</span></div><div className="card-footer"><small>Posted by {item.owner_name}</small><button className="btn small outline">View Details</button></div></div></article>}

function ItemModal({onClose,onCreated}) {
  const [form,setForm]=useState({name:"",description:"",category:"Books",condition:"Good",exchangeType:"Exchange",location:"",preferredExchange:""});
  const [error,setError]=useState("");
  const submit=async e=>{e.preventDefault();try{await api("/api/items",{method:"POST",body:JSON.stringify(form)});onCreated()}catch(e){setError(e.message)}};
  return <Modal title="Post an Item" onClose={onClose}><form onSubmit={submit} className="form-grid">
    <Field label="Item name *"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Category *"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field>
    <Field label="Condition *"><select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})}><option>Excellent</option><option>Good</option><option>Fair</option></select></Field>
    <Field label="Exchange type *"><select value={form.exchangeType} onChange={e=>setForm({...form,exchangeType:e.target.value})}><option>Exchange</option><option>Donation</option><option>Giveaway</option></select></Field>
    <Field label="Campus location *"><input required value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Field>
    <Field label="Preferred exchange"><input value={form.preferredExchange} onChange={e=>setForm({...form,preferredExchange:e.target.value})}/></Field>
    <Field label="Description *" full><textarea required rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
    {error&&<div className="error full">{error}</div>}<button className="btn primary full">Publish Item</button>
  </form></Modal>
}

function Announcements(){
  const [items,setItems]=useState([]),[q,setQ]=useState("");
  const load=()=>api(`/api/announcements?search=${encodeURIComponent(q)}`).then(setItems);
  useEffect(()=>{load()},[]);
  return <Page><PageHero icon={<Bell/>} title="Announcements" text="Important college, department, examination, scholarship and club updates."/>
    <section className="section"><div className="container"><div className="filters"><div className="search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search announcements…" onKeyDown={e=>e.key==="Enter"&&load()}/></div><button className="btn outline" onClick={load}>Search</button></div><div className="three-grid">{items.map(a=><AnnouncementCard key={a.id} a={a}/>)}</div></div></section></Page>
}
function AnnouncementCard({a}){return <article className="announcement card"><div className="card-top"><span className="category">{a.category}</span>{a.priority==="Urgent"&&<span className="priority"><AlertTriangle size={13}/> Urgent</span>}</div><h3>{a.title}</h3><p>{a.description}</p><div className="card-footer"><small>{new Date(a.published_at).toLocaleDateString()}</small><button className="btn small outline">Read More</button></div></article>}

function Clubs({user}){
  const [clubs,setClubs]=useState([]),[q,setQ]=useState("");
  const load=()=>api("/api/clubs").then(setClubs);
  useEffect(()=>{if(user)load()},[user]);
  const join=async id=>{if(!user)return alert("Please log in first.");await api(`/api/clubs/${id}/join`,{method:"POST"});load()};
  const visible=clubs.filter(c=>(c.name+c.category+c.description).toLowerCase().includes(q.toLowerCase()));
  return <Page><PageHero icon={<Users/>} title="Clubs" text="Find your community and participate in activities you care about."/>
    <section className="section"><div className="container"><div className="filters"><div className="search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search clubs…"/></div></div><div className="three-grid">{visible.map(c=><article className="club-card card" key={c.id}><div className="club-logo">{c.logo}</div><span className="category">{c.category}</span><h3>{c.name}</h3><p>{c.description}</p><div className="member-row"><Users size={16}/>{c.members} members <button className={`btn small ${c.joined?"outline":"primary"}`} onClick={()=>join(c.id)}>{c.joined?"Joined":"Join Club"}</button></div></article>)}</div></div></section></Page>
}

function Events({user}){
  const [events,setEvents]=useState([]),[q,setQ]=useState(""),[msg,setMsg]=useState("");
  const load=()=>api(`/api/events?search=${encodeURIComponent(q)}`).then(setEvents);
  useEffect(()=>{load()},[]);
  const register=async id=>{if(!user)return setMsg("Please log in to register.");try{await api(`/api/events/${id}/register`,{method:"POST"});setMsg("Registration successful!");load()}catch(e){setMsg(e.message)}};
  return <Page><PageHero icon={<CalendarDays/>} title="Events" text="Discover workshops, competitions, cultural activities and student programs."/>
    <section className="section"><div className="container"><div className="filters"><div className="search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search events…"/></div><button className="btn outline" onClick={load}>Search</button></div>{msg&&<div className="notice">{msg}</div>}<div className="three-grid">{events.map(e=><EventCard key={e.id} event={e} register={()=>register(e.id)}/>)}</div></div></section></Page>
}
function EventCard({event,register}){return <article className="event-card card"><div className="event-image">{event.image||"🎓"}<span className="pill">{event.category}</span></div><div className="card-body"><h3>{event.name}</h3><div className="meta stacked"><span><CalendarDays size={15}/>{new Date(event.event_date).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}</span><span><MapPin size={15}/>{event.venue}</span><span><Users size={15}/>{event.participants} registered</span></div><p>{event.description}</p><div className="card-footer"><small>{event.organizer}</small>{register&&<button className="btn small primary" onClick={register}>Register</button>}</div></div></article>}

function LostFound({user}){
  const [posts,setPosts]=useState([]),[type,setType]=useState(""),[q,setQ]=useState(""),[modal,setModal]=useState(false),[msg,setMsg]=useState("");
  const load=()=>api(`/api/lost-found?search=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`).then(setPosts);
  useEffect(()=>{load()},[type]);
  const recover=async id=>{try{await api(`/api/lost-found/${id}/recover`,{method:"PATCH"});load()}catch(e){setMsg(e.message)}};
  return <Page><PageHero icon={<Search/>} title="Lost & Found" text="Report lost or found belongings and help return them to their owners." action={user?<button className="btn primary" onClick={()=>setModal(true)}><Plus size={18}/> Report Item</button>:<Link className="btn primary" to="/login">Login to Report</Link>}/>
    <section className="section"><div className="container"><div className="filters"><div className="search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search lost or found items…"/></div><select value={type} onChange={e=>setType(e.target.value)}><option value="">All posts</option><option>Lost</option><option>Found</option></select><button className="btn outline" onClick={load}>Search</button></div>{msg&&<div className="error">{msg}</div>}<div className="three-grid">{posts.map(p=><article className="lost-card card" key={p.id}><div className={`lost-image ${p.type.toLowerCase()}`}>{p.image||"🔎"}</div><div className="card-body"><span className={`status ${p.type.toLowerCase()}`}>{p.type}</span><span className="status neutral">{p.status}</span><h3>{p.name}</h3><p>{p.description}</p><div className="meta"><span><Tag size={14}/>{p.category}</span><span><MapPin size={14}/>{p.location}</span></div><div className="card-footer"><small>{p.poster_name}</small>{user&&p.status==="Active"&&p.poster_name===user.name&&<button className="btn small outline" onClick={()=>recover(p.id)}>Recovered</button>}</div></div></article>)}</div></div></section>
    {modal&&<LostModal onClose={()=>setModal(false)} onCreated={()=>{setModal(false);load()}}/>}
  </Page>
}

function LostModal({onClose,onCreated}){
  const [form,setForm]=useState({type:"Lost",name:"",description:"",category:"Personal",location:""});
  const [error,setError]=useState("");
  const submit=async e=>{e.preventDefault();try{await api("/api/lost-found",{method:"POST",body:JSON.stringify(form)});onCreated()}catch(e){setError(e.message)}};
  return <Modal title="Report Lost / Found Item" onClose={onClose}><form onSubmit={submit} className="form-grid"><Field label="Post type"><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Lost</option><option>Found</option></select></Field><Field label="Item name"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Category"><input required value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></Field><Field label="Location"><input required value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Field><Field label="Description" full><textarea required rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>{error&&<div className="error full">{error}</div>}<button className="btn primary full">Publish Report</button></form></Modal>
}

function Dashboard({user}){
  const [data,setData]=useState(null);
  useEffect(()=>{if(user)api("/api/dashboard").then(setData)},[user]);
  if(!user)return <RedirectLogin/>;
  if(!data)return <Page><div className="screen-loader"><div className="spinner"></div></div></Page>;
  return <Page><section className="dashboard-head"><div className="container"><div className="eyebrow"><CircleUserRound size={16}/> Student dashboard</div><h1>Welcome back, {data.user.name.split(" ")[0]} 👋</h1><p>Here’s what is happening across your campus community.</p></div></section>
    <section className="section"><div className="container">
      <div className="dashboard-stats"><Stat n={data.myItems.length} label="My marketplace posts"/><Stat n={data.saved.length} label="Saved items"/><Stat n={data.events.length} label="Registered events"/><Stat n={data.clubs.length} label="Joined clubs"/></div>
      <div className="dashboard-grid">
        <DashPanel title="Recent announcements" icon={<Bell/>}><Link to="/announcements" className="panel-link">View all</Link>{data.notifications.slice(0,4).map(n=><div className="notification" key={n.id}><div className="notification-icon"><Bell size={16}/></div><div><b>{n.message}</b><small>{new Date(n.created_at).toLocaleString()}</small></div></div>)}{!data.notifications.length&&<Empty title="No notifications" text="You're all caught up."/>}</DashPanel>
        <DashPanel title="My profile" icon={<CircleUserRound/>}><div className="profile-mini"><div className="big-avatar">👤</div><div><h3>{data.user.name}</h3><p>{data.user.course} · {data.user.department}</p><p>{data.user.year} · {data.user.campus}</p></div></div><div className="progress-label"><span>Profile completion</span><b>80%</b></div><div className="progress"><span style={{width:"80%"}}></span></div></DashPanel>
        <DashPanel title="My marketplace items" icon={<Package/>}><Link to="/marketplace" className="panel-link">Marketplace</Link>{data.myItems.slice(0,3).map(i=><div className="mini-row" key={i.id}><span>{i.image||"📦"}</span><div><b>{i.name}</b><small>{i.exchange_type} · {i.condition}</small></div></div>)}{!data.myItems.length&&<Empty title="No posts yet" text="Post a reusable item."/>}</DashPanel>
        <DashPanel title="My events" icon={<CalendarDays/>}><Link to="/events" className="panel-link">Explore events</Link>{data.events.slice(0,3).map(e=><div className="mini-row" key={e.id}><span>{e.image||"🎓"}</span><div><b>{e.name}</b><small>{new Date(e.event_date).toLocaleDateString()} · {e.venue}</small></div></div>)}{!data.events.length&&<Empty title="No registrations" text="Find an event to join."/>}</DashPanel>
      </div>
    </div></section>
  </Page>
}

function DashPanel({title,icon,children}){return <div className="dash-panel card"><div className="panel-head"><div><span className="icon-box">{icon}</span><h2>{title}</h2></div></div>{children}</div>}

function Auth({mode,setUser}){
  const login=mode==="login", nav=useNavigate();
  const [form,setForm]=useState({name:"",email:"",password:"",course:"",department:"",year:"",campus:"Main Campus",role:"student",adminCode:""}),[error,setError]=useState("");

  const submit=async e=>{
    e.preventDefault();
    try{
      const d=await api(`/api/auth/${login?"login":"register"}`,{method:"POST",body:JSON.stringify(form)});
      localStorage.setItem("cc_token",d.token);
      setUser(d.user);
      nav("/dashboard");
    }catch(e){setError(e.message)}
  };

  return <Page>
    <section className="auth-section">
      <div className="auth-card card">
        <div className="auth-brand">
          <span className="brand-mark"><Leaf size={22}/></span>
          <h1>{login?"Welcome back":"Join CampusConnect"}</h1>
          <p>{login?"Sign in to your campus community.":"Create your student community account."}</p>
        </div>

        <form onSubmit={submit} className="form-grid">
          {!login && <>
            <Field label="Full name">
              <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
            </Field>

            <Field label="Course">
              <input value={form.course} onChange={e=>setForm({...form,course:e.target.value})}/>
            </Field>

            <Field label="Department">
              <input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/>
            </Field>

            <Field label="Year">
              <select value={form.year} onChange={e=>setForm({...form,year:e.target.value})}>
                <option value="">Select year</option>
                <option>1st Year</option>
                <option>2nd Year</option>
                <option>3rd Year</option>
                <option>4th Year</option>
              </select>
            </Field>

            <Field label="Account Type">
              <select
                value={form.role}
                onChange={e=>setForm({...form,role:e.target.value,adminCode:""})}
              >
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </Field>

            {form.role==="admin" && (
              <Field label="Admin Registration Code">
                <input
                  type="password"
                  required
                  value={form.adminCode}
                  onChange={e=>setForm({...form,adminCode:e.target.value})}
                />
              </Field>
            )}
          </>}

          <Field label="Email">
            <input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
          </Field>

          <Field label="Password">
            <input type="password" required minLength="6" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
          </Field>

          {error&&<div className="error full">{error}</div>}
          <button className="btn primary full">
            {login?<><LogIn size={18}/> Login</>:<>Create Account <ArrowRight size={18}/></>}
          </button>
        </form>

        {login?
          <p className="auth-switch">New here? <Link to="/register">Create an account</Link></p>:
          <p className="auth-switch">Already registered? <Link to="/login">Login</Link></p>
        }
      </div>
    </section>
  </Page>
}

function Field({label,children,full=false}){return <label className={full?"field full":"field"}><span>{label}</span>{children}</label>}
function Modal({title,onClose,children}){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>{children}</div></div>}
function Empty({title,text}){return <div className="empty"><Package size={28}/><h3>{title}</h3><p>{text}</p></div>}
function PageHero({icon,title,text,action}){return <section className="page-hero"><div className="container page-hero-inner"><div><div className="hero-icon">{icon}</div><h1>{title}</h1><p>{text}</p></div>{action}</div></section>}
function RedirectLogin(){const nav=useNavigate();useEffect(()=>nav("/login"),[]);return null}
function Page({children}){return <>{children}</>}
function Footer(){return <footer><div className="container footer-grid"><div><Link className="brand" to="/"><span className="brand-mark"><Leaf size={18}/></span><span>Campus<span>Connect</span></span></Link><p>Reuse more. Connect better. Engage together.</p></div><div><h4>Platform</h4><Link to="/marketplace">Marketplace</Link><Link to="/announcements">Announcements</Link><Link to="/clubs">Clubs</Link><Link to="/events">Events</Link></div><div><h4>Community</h4><Link to="/lost-found">Lost & Found</Link><a href="#">Help Center</a><a href="#">Community Guidelines</a></div><div><h4>Legal</h4><a href="#">Privacy Policy</a><a href="#">Terms of Use</a><a href="#">Contact Us</a></div></div><div className="container footer-bottom"><span>© 2026 CampusConnect</span><span>Built for student communities 🌱</span></div></footer>}

function AdminPanel({ user }) {
const [users, setUsers] = useState([]);
const [search, setSearch] = useState("");
const [selectedUser, setSelectedUser] = useState(null);
const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    api("/api/admin/users")
      .then(setUsers)
      .catch(e => setError(e.message));
  }, [user]);

  if (!user || user.role !== "admin") {
    return <RedirectLogin />;
  }

  return (
    <Page>
      {selectedUser && (
  <Modal
    title="User Details"
    onClose={() => setSelectedUser(null)}
  >
    <div className="profile-mini">
      <div className="big-avatar">👤</div>
      <div>
        <h3>{selectedUser.name}</h3>
        <p>{selectedUser.email}</p>
      </div>
    </div>

    <div className="meta stacked">
      <span><b>Course:</b> {selectedUser.course || "Not provided"}</span>
      <span><b>Department:</b> {selectedUser.department || "Not provided"}</span>
      <span><b>Year:</b> {selectedUser.year || "Not provided"}</span>
      <span><b>Campus:</b> {selectedUser.campus}</span>
      <span><b>Role:</b> {selectedUser.role}</span>
      <span><b>Status:</b> {selectedUser.status || "active"}</span>
    </div>
  </Modal>
)}
      <section className="dashboard-head">
        <div className="container">
          <div className="eyebrow">
            <ShieldCheck size={16} /> Admin panel
          </div>
          <h1>Admin Dashboard</h1>
          <p>Manage CampusConnect users and platform activity.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {error && <div className="error">{error}</div>}

          <div className="dashboard-stats">
            <Stat n={users.length} label="Registered users" />
            <Stat
              n={users.filter(u => u.role === "admin").length}
              label="Administrators"
            />
            <Stat
              n={users.filter(u => u.role === "student").length}
              label="Students"
            />
          </div>
<div className="filters">
  <div className="search">
    <Search />
    <input
      value={search}
      onChange={e => setSearch(e.target.value)}
      placeholder="Search users by name or email..."
    />
  </div>
</div>
          <div className="dash-panel card admin-users-panel">
            
          
            <div className="panel-head">
              <div>
                <span className="icon-box">
                  <Users />
                </span>
                <h2>Users</h2>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Course</th>
                    <th>Department</th>
                    <th>Year</th>
                    <th>Campus</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  <table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Course</th>
      <th>Department</th>
      <th>Year</th>
      <th>Campus</th>
      <th>Role</th>
      <th>Status</th>
      <th>Actions</th>
    </tr>
  </thead>

  <tbody>
    {users
      .filter(u =>
        `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
      )
      .map(u => (
        <tr key={u.id}>
          <td>{u.name}</td>
          <td>{u.email}</td>
          <td>{u.course || "-"}</td>
          <td>{u.department || "-"}</td>
          <td>{u.year || "-"}</td>
          <td>{u.campus || "-"}</td>
          <td>{u.role}</td>
          <td>{u.status || "active"}</td>
          <td>
            {/* buttons */}
          </td>
        </tr>
      ))}
  </tbody>
</table>
                  {users
  .filter(u =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )
  .map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.course}</td>
                      <td>{u.department}</td>
                      <td>{u.year}</td>
                      <td>{u.campus}</td>
                      <td>{u.role}</td>
                      <td>{u.status || "active"}</td>
<td>
  <button
    className="btn small outline"
    onClick={() => toggleUserStatus(u)}
    disabled={u.id === user.id}
  >
    {u.status === "blocked" ? "Unblock" : "Block"}
  </button>

  <button
    className="btn small outline"
    onClick={() => setSelectedUser(u)}
  >
    View
  </button>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!users.length && (
                <Empty
                  title="No users found"
                  text="There are no registered users yet."
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}
export default App;
