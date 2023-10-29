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
      if((i == 'Grandma' && best_building_cps_per_building.last_building != 'Grandma') && Object.keys(Game.buffs).length > 0) { continue; }
      var object_name = Game.Objects[i].name
      // var cps_per_object = Game.Objects[i].cps(Game.Objects[i])/ Game.Objects[i].getPrice()
      var cps_per_object = get_actual_cps(i)/ Game.Objects[i].getPrice()
      if(cps_per_object > best_cps_per_building) {
         best_i = i;
         best_name = object_name;
         best_cps_per_building = cps_per_object;
      }
   }
   best_building_cps_per_building.last_building = i;
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
 
   // lets see if we can do better by buying something that will pay for itself before time_to_buy
   // turns out I don't think this ever is true
   var fastest_payoff_i = best_cps_building;
   var least_time_to_pay_for = time_to_buy;

   for (var i in Game.Objects) 
   {
      // we want to skip grandmas during buffs 
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

function get_next_cookie_upgrade()
{
   var max_cookie_upgrade = -1;
   var max_cookie_upgrade_value = 0;
   for (i in Game.UpgradesInStore) {
      if(Game.UpgradesInStore[i].pool == "cookie") {
         upgrade_cps = Game.cookiesPs * (Game.UpgradesInStore[i].power / 100);
         upgrade_value = upgrade_cps / Game.UpgradesInStore[i].basePrice;
         if(upgrade_value > max_cookie_upgrade_value) {
            max_cookie_upgrade_value = upgrade_value;
            max_cookie_upgrade = i;
         }
      }
   }
   return max_cookie_upgrade;
}

function get_next_non_cookie_upgrade()
{
   for(i in Game.UpgradesInStore) {
      if(Game.UpgradesInStore[i].pool != 'cookie') {
         return i;
      }
   }
   return -1;
}

function log_next_purchase(price, name) {
   var time_to_buy = Math.ceil((price - Game.cookies) / (Game.cookiesPs + (Game.computedMouseCps * 1000/50)));

   if(
      name != log_next_purchase.last_name ||
      time_to_buy > log_next_purchase.last_time_to_buy ||
      time_to_buy < 10 ||
      Math.abs(time_to_buy - log_next_purchase.last_tick_time_to_buy) > 2 ||
      time_to_buy / Math.pow(10, Math.floor(Math.log10(time_to_buy))) == Math.round(time_to_buy / Math.pow(10, Math.floor(Math.log10(time_to_buy)))) 
      )
   {
      log_next_purchase.last_time_to_buy = time_to_buy;
      log_next_purchase.last_name = name;
      console.log("time to", name, "(", Beautify(price), ") is", Math.ceil(time_to_buy) );
   }
   log_next_purchase.last_tick_time_to_buy = time_to_buy;
}

function buy_best_building()
{
   var building = best_building();
   var building_cps = get_actual_cps(building);
   var building_price = Game.Objects[building].getPrice();
   var building_value = building_cps / building_price;

   var cookie_upgrade = get_next_cookie_upgrade();
   var cookie_upgrade_cps = Game.cookiesPs * (Game.UpgradesInStore[cookie_upgrade].power / 100);
   var cookie_upgrade_price = Game.UpgradesInStore[cookie_upgrade].basePrice;
   var cookie_upgrade_value = cookie_upgrade_cps / cookie_upgrade_price;

   var non_cookie_upgrade = get_next_non_cookie_upgrade();
   var non_cookie_upgrade_price = -1;
   if(non_cookie_upgrade != -1) {
      non_cookie_upgrade_price = Game.UpgradesInStore[non_cookie_upgrade].getPrice();      
   }

   // if there's a non-cookie upgrade that's cheaper than the best building we buy that
   // if there's not, then it's either the building or the cookie based on value 

   if(non_cookie_upgrade_price > 0 && (non_cookie_upgrade_price < building_price || non_cookie_upgrade_price < cookie_upgrade_price )) {
      if(Game.UpgradesInStore[non_cookie_upgrade].canBuy()) {
         console.log("Bought upgrade", Game.UpgradesInStore[non_cookie_upgrade].name);
         Game.UpgradesInStore[non_cookie_upgrade].buy();
         buy_best_building.last_next_purchase = '';
      } else {
         log_next_purchase(non_cookie_upgrade_price, Game.UpgradesInStore[non_cookie_upgrade].name);
         buy_best_building.last_next_purchase = Game.UpgradesInStore[non_cookie_upgrade].name;
      }
      return;
   }

   // don't buy cookies during buffs as we can't estimate the value properly 
   // unless the last object was a cookie

   if(debug_level > 0) {
      console.log(Object.keys(Game.buffs).length, buy_best_building.last_next_purchase, buy_best_building.last_next_purchase in Game.Upgrades ? Game.Upgrades[buy_best_building.last_next_purchase].pool : 'non-upgrade');
   }
   if(Object.keys(Game.buffs).length == 0 || (buy_best_building.last_next_purchase in Game.Upgrades && Game.Upgrades[buy_best_building.last_next_purchase].pool == 'cookie')) {
      if(cookie_upgrade_value > building_value) {
         if(Game.UpgradesInStore[cookie_upgrade].canBuy()) {
            console.log("Bought upgrade", Game.UpgradesInStore[cookie_upgrade].name);
            Game.UpgradesInStore[cookie_upgrade].buy();
            buy_best_building.last_next_purchase = '';
         } else {
            log_next_purchase(cookie_upgrade_price, Game.UpgradesInStore[cookie_upgrade].name);
            buy_best_building.last_next_purchase = Game.UpgradesInStore[non_cookie_upgrade].name;
         }
         return;
      }
   }
   // Nothing left but a building to buy

   if(building_price < Game.cookies) {
      console.log("bought building", building);
      Game.Objects[building].buy(1);
      buy_best_building.last_next_purchase = '';
   } else {
      log_next_purchase(building_price, building);
      buy_best_building.last_next_purchase = building;
   }
}

var clicker = 0;
var buyer = 0;
var debug_level = 0;

function click()
{
   Game.ClickCookie();
   click_golden();
}

function buy()
{
   buy_best_building();
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

function debug_game(val)
{
   debug_level = val;
}


