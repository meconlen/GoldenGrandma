function click_golden() {
   Game.shimmers.forEach(
      function(shimmer)
      {
         if(shimmer.type == "golden" && shimmer.wrath == 0) {
            shimmer.pop()
         }
      }
   )
}

function get_actual_cps(building)
{
   if(building != 'Grandma') {
      return Game.Objects[building].cps(Game.Objects[building]);
   }
   var grandma_count = Game.Objects['Grandma'].amount;


   var synergiesWith={};
   var synergyBoost=0;
   for (var i in Game.GrandmaSynergies) {
      if (Game.Has(Game.GrandmaSynergies[i])) {
         var other=Game.Upgrades[Game.GrandmaSynergies[i]].buildingTie;
         var mult=Game.Objects['Grandma'].amount*0.01*(1/(other.id-1));
         var boost=(other.storedTotalCps*Game.globalCpsMult)-(other.storedTotalCps*Game.globalCpsMult)/(1+mult);
         synergyBoost+=boost;
         if (!synergiesWith[other.plural]) synergiesWith[other.plural]=0;
         synergiesWith[other.plural]+=mult;
      }
   }
   return Game.Objects[building].cps(Game.Objects[building]) + synergyBoost / (grandma_count == 0 ? 1 : grandma_count);
}


function best_building_cps_per_building()
{
   var best_i = 0;
   var best_name = "";
   var best_cps_per_building = 0;
   for (var i in Game.Objects) 
   { 
      var object_name = Game.Objects[i].name
      // var cps_per_object = Game.Objects[i].cps(Game.Objects[i])/ Game.Objects[i].getPrice()
      var cps_per_object = get_actual_cps(i)/ Game.Objects[i].getPrice()
      if(cps_per_object > best_cps_per_building) {
         best_i = i;
         best_name = object_name;
         best_cps_per_building = cps_per_object;
      }
   }
   // console.log(best_name, Beautify(Game.Objects[best_name].getPrice()), Math.round(get_actual_cps(best_name)));
   return best_i;
}


// we want to buy the most valuable building however it may take a while to afford it (Game.Objects[i].getPrice() > Game.cookies)
// it will take us time_to_buy = (Game.Objects[i].getPrice() - Game.cookies) / (Game.cookiesPs + (Game.computedMouseCps * 1000/50))
// is there another building which we can buy now and would pay for itself in that amount of time
// Game.Objects[i].cps(Game.Objects[i]) * time_to_buy > Game.Objects[i].getPrice()
//
// if so, which one would pay for itself the fastest

function best_building()
{
   // find the most valuable building
   var best_cps_building = best_building_cps_per_building();
   // if we can buy the most valuable building then buy it
   if(Game.Objects[best_cps_building].getPrice() <= Game.cookies) {
      // console.log("buy best building is ", best_cps_building);
      return best_cps_building;
   }

   // if we can't get the most valuable building it will take us this time_to_buy
   var time_to_buy = (Game.Objects[best_cps_building].getPrice() - Game.cookies) / (Game.cookiesPs + (Game.computedMouseCps * 1000/50));
   if(best_cps_building != best_building.last_best || 
      Math.ceil(time_to_buy) > best_building.last_time_to_buy ||
      Math.ceil(time_to_buy) < 10 || 
      Math.ceil(time_to_buy) / Math.pow(10, Math.floor(Math.log10(Math.ceil(time_to_buy)))) == Math.round( Math.ceil(time_to_buy) / Math.pow(10, Math.floor(Math.log10(Math.ceil(time_to_buy))))  ) 
   ) {
      best_building.last_best = best_cps_building;
      console.log("time to buy", best_cps_building, " (", Beautify(Game.Objects[best_cps_building].getPrice()) , ") is", Math.ceil(time_to_buy));
   }
      // lets see if we can do better
   var fastest_payoff_i = best_cps_building;
   var least_time_to_pay_for = time_to_buy;

   for (var i in Game.Objects) 
   {
      if(Game.Objects[i].getPrice() <= Game.cookies) {
         // how many seconds before the cps > getPrice
         var time_to_pay_for = Game.Objects[i].getPrice() / Game.Objects[i].cps(Game.Objects[i]);
         // if it will pay for itself
         if(time_to_pay_for < time_to_buy)
         {
            console.log("We can pay for ", i, " in ", time_to_pay_for, " rather than ", time_to_buy, " seconds for ", fastest_payoff_i);
            if (time_to_pay_for < least_time_to_pay_for) {
               fastest_payoff_i = i;
               least_time_to_pay_for = time_to_pay_for;
            }
         }
      }
   }

   // return the building that pays for itself the fastest or the best_cps_building if none exists 
   return fastest_payoff_i;
}


function buy_best_building()
{
   var building = best_building();
   var building_cps = get_actual_cps(building);
   var cookie;
   // only do this if not shimmering since shimmers bust the computations 
   if(Object.keys(Game.buffs).length == 0) {
      for (i in Game.UpgradesInStore)
      {
         if(Game.UpgradesInStore[i].pool == "cookie") {
            upgrade_cps = Game.cookiesPs * (Game.UpgradesInStore[i].power / 100);
            if(upgrade_cps > building_cps) {
               if(Game.UpgradesInStore[i].canBuy()) {
                  Game.UpgradesInStore[i].buy();
               }
            }
         }
      }
   }
   if(Game.Objects[building].getPrice() < Game.cookies) {
      Game.Objects[building].buy(1);
      buy_best_building();
   }
};

function buy_available_upgrades()
{
   for(var i in Game.UpgradesInStore) {
      if(Game.UpgradesInStore[i].name != 'One mind') {
         if(Game.UpgradesInStore[i].canBuy() && Game.UpgradesInStore[i].pool != "cookie") {
            console.log("bought upgrade ", Game.UpgradesInStore[i].name);
            Game.UpgradesInStore[i].buy();
         }
      }
   }
}

// var autoClicker = setInterval(Game.ClickCookie, 50);
// var autoGolden = setInterval(click_golden, 50);

var clicker = 0;
var buyer = 0;


function click()
{
   Game.ClickCookie();
   click_golden();
}


function buy()
{
   buy_best_building();
   buy_available_upgrades();
}


function start_game()
{
   clicker = setInterval(click, 50);
   buyer = setInterval(buy, 1000);
}

function stop_game()
{
   clearInterval(clicker);
   clearInterval(buyer);
}


function reset_game()
{
   Game.Reset();
}




