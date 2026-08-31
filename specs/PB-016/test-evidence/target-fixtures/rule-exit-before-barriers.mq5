#property strict
// AITrading mql5-research-1.0.0 | schema 1.0.0 | validator 1.0.0
// Strategy 11111111-1111-1111-1111-111111111111 revision 2 | DSL SHA256 0ac226620d3c129ad3fc3785d9113210cf5c015bcbbc91b40b274fdf7b52e4f5
// RESEARCH ONLY: CSV simulation, not native Strategy Tester or live trading.
// Binary doubles differ from Decimal34; inspect official target evidence. No profit guarantee.
// Trusted research runtime. No orders, network, DLL or shell calls.
#define UNDEFINED DBL_MAX
struct Series
{
   double values[];
   void Add(double value) { int n=ArraySize(values); ArrayResize(values,n+1,5000); values[n]=value; }
};
bool Defined(double v) { return v!=UNDEFINED && MathIsValidNumber(v); }
double At(Series &s,int lag) { int p=ArraySize(s.values)-1-lag; return p<0 ? UNDEFINED : s.values[p]; }
string Text(double v) { return Defined(v) ? StringFormat("%.17g",v) : "null"; }
double Smooth(Series &s,int period,int mode,double previous)
{
   if(ArraySize(s.values)<period) return UNDEFINED;
   double total=0,extreme=At(s,0);
   for(int k=0;k<period;k++)
   {
      double v=At(s,k); if(!Defined(v)) return UNDEFINED;
      total+=v; extreme=mode==3 ? MathMax(extreme,v) : MathMin(extreme,v);
   }
   if(mode>=3) return extreme;
   if(mode==0 || !Defined(previous)) return total/period;
   double alpha=mode==1 ? 2.0/(period+1) : 1.0/period;
   return previous+alpha*(At(s,0)-previous);
}
double Pivot(Series &s,int left,int right,bool highPivot)
{
   if(ArraySize(s.values)<left+right+1) return UNDEFINED;
   double candidate=At(s,right);
   for(int k=0;k<=left+right;k++)
      if(k!=right && (highPivot ? candidate<=At(s,k) : candidate>=At(s,k))) return UNDEFINED;
   return candidate;
}
int RuleNot(int a) { return a==-1 ? -1 : 1-a; }
int RuleAll(int a,int b) { return a==0 || b==0 ? 0 : a==-1 || b==-1 ? -1 : 1; }
int RuleAny(int a,int b) { return a==1 || b==1 ? 1 : a==-1 || b==-1 ? -1 : 0; }
int Compare(double a,double b,int op)
{
   if(!Defined(a) || !Defined(b)) return -1;
   bool result=op==0 ? a>b : op==1 ? a>=b : op==2 ? a<b : op==3 ? a<=b : op==4 ? a==b : a!=b;
   return result ? 1 : 0;
}
int Cross(double a,double b,double beforeA,double beforeB,bool above)
{
   if(!Defined(a)||!Defined(b)||!Defined(beforeA)||!Defined(beforeB)) return -1;
   return (above ? a>b && beforeA<=beforeB : a<b && beforeA>=beforeB) ? 1 : 0;
}
struct Candle { datetime time; double open,high,low,close,volume; };
struct Simulation
{
   double balance,equity,entryPrice,quantity,stopPrice,targetPrice,entryFee;
   int side,pending,signalBar,entrySide,entrySignalBar,exitSide,exitReason,exitSignalBar,signal,skip,skipOpen;
   double entryFill,entryCost,exitFill,exitCost,closedNet;
   void Init(double capital)
   {
      balance=capital; equity=capital; side=0; pending=0; signalBar=-1; quantity=0;
      entryPrice=UNDEFINED; stopPrice=UNDEFINED; targetPrice=UNDEFINED; entryFee=0;
   }
   double Fill(double raw,bool buy,double adverse) { return raw*(buy ? 1+adverse : 1-adverse); }
   void Close(double raw,int reason,double adverse,double commission)
   {
      double price=Fill(raw,side==-1,adverse),fee=price*quantity*commission;
      double gross=(price-entryPrice)*quantity*side;
      balance+=gross-fee; exitSide=side; exitFill=price; exitCost=fee; exitReason=reason;
      closedNet=gross-entryFee-fee; side=0;
   }
   void OpenBar(Candle &c,double allocation,double leverage,double stopPct,double targetPct,double adverse,double commission)
   {
      entrySide=0; entryFill=UNDEFINED; entryCost=UNDEFINED; entrySignalBar=-1;
      exitSide=0; exitFill=UNDEFINED; exitCost=UNDEFINED; exitReason=0; exitSignalBar=-1;
      closedNet=UNDEFINED; signal=0; skip=0; skipOpen=0;
      int order=pending; pending=0;
      if(order==2) { exitSignalBar=signalBar; Close(c.open,1,adverse,commission); }
      else if(order!=0)
      {
         if(balance<=0) skipOpen=1;
         else
         {
            side=order; entryPrice=Fill(c.open,order==1,adverse);
            quantity=balance*allocation/100.0*leverage/entryPrice;
            entryFee=entryPrice*quantity*commission; balance-=entryFee;
            stopPrice=entryPrice*(1-order*stopPct/100.0); targetPrice=entryPrice*(1+order*targetPct/100.0);
            entrySide=order; entryFill=entryPrice; entryCost=entryFee; entrySignalBar=signalBar;
         }
      }
      if(side!=0)
      {
         bool hitStop=side==1 ? c.low<=stopPrice : c.high>=stopPrice;
         bool hitTarget=side==1 ? c.high>=targetPrice : c.low<=targetPrice;
         if(hitStop) Close(side==1 ? MathMin(c.open,stopPrice) : MathMax(c.open,stopPrice),2,adverse,commission);
         else if(hitTarget) Close(targetPrice,3,adverse,commission);
      }
      equity=balance+(side==0 ? 0 : (c.close-entryPrice)*quantity*side);
   }
   void CloseBar(int index,int longEntry,int shortEntry,int longExit,int shortExit)
   {
      if(side!=0) { if((side==1 ? longExit : shortExit)==1) pending=2; }
      else if(longEntry==1 && shortEntry==1) skip=2;
      else if(longEntry==1 || shortEntry==1) pending=longEntry==1 ? 1 : -1;
      if(pending!=0) { signalBar=index; signal=pending; }
   }
};
bool SafeFilename(string name)
{
   int n=StringLen(name); if(n<5 || n>80 || StringFind(name,"..")>=0 || StringSubstr(name,n-4)!=".csv") return false;
   string stem=StringSubstr(name,0,StringFind(name,".")); StringToUpper(stem);
   if(stem=="CON"||stem=="PRN"||stem=="AUX"||stem=="NUL") return false;
   if(StringLen(stem)==4 && (StringSubstr(stem,0,3)=="COM"||StringSubstr(stem,0,3)=="LPT"))
   { ushort digit=StringGetCharacter(stem,3); if(digit>='1'&&digit<='9') return false; }
   for(int i=0;i<n;i++)
   {
      ushort c=StringGetCharacter(name,i);
      if(!((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_'||c=='-'||c=='.')) return false;
   }
   return true;
}
bool Number(string text,double &value,bool zeroAllowed)
{
   int n=StringLen(text),before=0,after=0; bool dot=false;
   if(n==0 || n>22) return false;
   for(int i=0;i<n;i++)
   {
      ushort c=StringGetCharacter(text,i);
      if(c=='.' && !dot && before>0) { dot=true; continue; }
      if(c<'0'||c>'9') return false;
      if(dot) after++; else before++;
   }
   if(before>13 || (dot&&(after==0||after>8))) return false;
   value=StringToDouble(text);
   return MathIsValidNumber(value) && value<=1000000000000.0 && (zeroAllowed ? value>=0 : value>=0.00000001);
}
bool Timestamp(string text,datetime &value,int interval)
{
   if(StringLen(text)!=20) return false;
   for(int i=0;i<20;i++)
   {
      ushort c=StringGetCharacter(text,i);
      if(i==4||i==7) { if(c!='-') return false; }
      else if(i==10) { if(c!='T') return false; }
      else if(i==13||i==16) { if(c!=':') return false; }
      else if(i==19) { if(c!='Z') return false; }
      else if(c<'0'||c>'9') return false;
   }
   string converted=text; StringReplace(converted,"-","."); StringReplace(converted,"T"," "); StringReplace(converted,"Z","");
   value=StringToTime(converted);
   string roundtrip=TimeToString(value,TIME_DATE|TIME_SECONDS); StringReplace(roundtrip,".","-"); StringReplace(roundtrip," ","T"); roundtrip+="Z";
   return roundtrip==text && value>=0 && value<D'2101.01.01' && (long)value%interval==0 && value+interval<=TimeGMT();
}
bool Csv(string name,Candle &rows[],int interval)
{
   if(!SafeFilename(name)) { Print("ERROR: CSV_FILENAME"); return false; }
   int h=FileOpen(name,FILE_READ|FILE_TXT|FILE_ANSI,0,CP_UTF8);
   if(h==INVALID_HANDLE) { Print("ERROR: CSV_UNAVAILABLE"); return false; }
   bool ok=true; int rowCount=0;
   if(FileSize(h)>1048576 || FileReadString(h)!="timestamp,open,high,low,close,volume") ok=false;
   while(ok && !FileIsEnding(h))
   {
      string line=FileReadString(h); string cells[];
      if(line=="" && FileIsEnding(h)) break;
      if(rowCount>=5000 || StringLen(line)>2048 || StringSplit(line,',',cells)!=6) { ok=false; break; }
      Candle c;
      if(!Timestamp(cells[0],c.time,interval) || !Number(cells[1],c.open,false) || !Number(cells[2],c.high,false) || !Number(cells[3],c.low,false) || !Number(cells[4],c.close,false) || !Number(cells[5],c.volume,true)) { ok=false; break; }
      if(c.high<MathMax(c.open,c.close)||c.low>MathMin(c.open,c.close)||c.high<c.low||(rowCount>0&&c.time!=rows[rowCount-1].time+interval)) { ok=false; break; }
      ArrayResize(rows,rowCount+1,5000); rows[rowCount++]=c;
   }
   FileClose(h);
   if(!ok || rowCount==0) { Print("ERROR: CSV_INVALID row ",rowCount+2); ArrayFree(rows); return false; }
   return true;
}
// END TRUSTED RUNTIME

const int IntervalSeconds=3600;
input string CsvFilename="research.csv";
input string ConfirmCsvSymbol=""; // Explicitly confirm the CSV provenance, not the chart/broker symbol.
input string ConfirmCsvTimeframe="";
input bool EmitTrace=true;
int count=0;
Series s_open;
Series s_high;
Series s_low;
Series s_close;
Series s_volume;
Simulation sim;
bool Process(Candle &c) {
   count++;
   s_open.Add(c.open);
   s_high.Add(c.high);
   s_low.Add(c.low);
   s_close.Add(c.close);
   s_volume.Add(c.volume);
   int longEntry=Compare(At(s_close,0),0.0,0);
   int shortEntry=-1;
   int longExit=Compare(At(s_close,0),100.0,1);
   int shortExit=-1;
   sim.OpenBar(c,100.0,1.0,50.0,100.0,(0.0/2.0+0.0)/10000.0,0.0/10000.0);
   sim.CloseBar(count-1,longEntry,shortEntry,longExit,shortExit);
   bool valid=Defined(sim.balance)&&Defined(sim.equity)&&Defined(sim.quantity)&&sim.quantity>=0;
   if(sim.entrySide!=0) valid=valid&&Defined(sim.entryFill)&&Defined(sim.entryCost);
   if(sim.exitSide!=0) valid=valid&&Defined(sim.exitFill)&&Defined(sim.exitCost)&&Defined(sim.closedNet);
   if(!valid) { Print("ERROR: NUMERIC_RANGE; no completed research result."); return false; }
   if(EmitTrace) {
      string trace="AITRADING_BAR|"+IntegerToString(count-1)+"|time="+IntegerToString((long)c.time);
      trace+="|longEntry="+IntegerToString(longEntry);
      trace+="|shortEntry="+IntegerToString(shortEntry);
      trace+="|longExit="+IntegerToString(longExit);
      trace+="|shortExit="+IntegerToString(shortExit);
      trace+="|balance="+Text(sim.balance);
      trace+="|equity="+Text(sim.equity);
      trace+="|quantity="+Text(sim.quantity);
      trace+="|entryFill="+Text(sim.entryFill);
      trace+="|entryCost="+Text(sim.entryCost);
      trace+="|exitFill="+Text(sim.exitFill);
      trace+="|exitCost="+Text(sim.exitCost);
      trace+="|closedNet="+Text(sim.closedNet);
      trace+="|side="+IntegerToString(sim.side);
      trace+="|signal="+IntegerToString(sim.signal);
      trace+="|entrySide="+IntegerToString(sim.entrySide);
      trace+="|entrySignalBar="+IntegerToString(sim.entrySignalBar);
      trace+="|exitSide="+IntegerToString(sim.exitSide);
      trace+="|exitSignalBar="+IntegerToString(sim.exitSignalBar);
      trace+="|exitReason="+IntegerToString(sim.exitReason);
      trace+="|skip="+IntegerToString(sim.skip);
      trace+="|skipOpen="+IntegerToString(sim.skipOpen);
      Print(trace);
   }
   return true;
}
int OnStart() {
   if(ConfirmCsvSymbol!="BTC_USDT" || ConfirmCsvTimeframe!="1h") { Print("ERROR: Confirm CSV symbol/timeframe provenance explicitly."); return 1; }
   Candle rows[]; if(!Csv(CsvFilename,rows,IntervalSeconds)) return 1;
   sim.Init(1000.0);
   Print("AITRADING_START|mql5-research-1.0.0|dslHash=0ac226620d3c129ad3fc3785d9113210cf5c015bcbbc91b40b274fdf7b52e4f5|bars=",ArraySize(rows));
   for(int i=0;i<ArraySize(rows);i++) { if(IsStopped()) { Print("ERROR: INTERRUPTED"); return 1; } if(!Process(rows[i])) return 1; }
   Print("AITRADING_END|cancelledPending=",sim.pending,"|openSide=",sim.side,"|balance=",Text(sim.balance),"|equity=",Text(sim.equity));
   sim.pending=0; return 0;
}
