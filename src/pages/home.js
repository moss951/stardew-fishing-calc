'use client'
import React, { useState, useEffect, useRef } from 'react';
import TimeSlider from '../components/TimeSlider';
import { RadioOptions, SmallOptions, BranchingOptions, ChildrenOptions } from '../components/RadioOptions';
import FishCard from '../components/FishCard';
import Checkbox from '../components/Checkbox';
import GenericSlider from '../components/GenericSlider';
import Layout from '../components/layout';
import Accordion from '../components/Accordion';
import Tooltip from '../components/Tooltip';
import TargetedContainer from '../components/TargetedContainer';
import { getFishFromLocationAndSeason, getFishAreas } from '../lib/locationdata';
import { getFishParameters, getFishNames } from '../lib/fishdata'; 
import { nonFishItems, getJellyChance, rollFishPool, targetedBaitSingle, rollFishPoolWithTargetedBait } from '../lib/calculateChance';
const _ = require("lodash"); 

export default function Home() {
  const [timeOfDay, setTimeOfDay] = useState(600);
  const [fishingLevel, setFishingLevel] = useState(10);
  const [waterDepth, setWaterDepth] = useState(5);
  const [selectedLocation, setSelectedLocation] = useState('Beach');
  const [selectedSeason, setSelectedSeason] = useState('spring');
  const [selectedSubArea, setSelectedSubArea] = useState("");
  const [selectedBobberArea, setSelectedBobberArea] = useState("");
  const [selectedMineArea, setSelectedMineArea] = useState("");
  const [targetedBaitName, setTargetedBaitName] = useState("");
  const [trashRate, setTrashRate] = useState(1);
  const [jellyMode, setJellyMode] = useState("longterm");
  const [luckBuffs, setLuckBuffs] = useState(0);
  const [dailyLuck, setDailyLuck] = useState(0);
  const [checkedItems, setCheckedItems] = useState({
    isCuriosityLureActive: false,
    isExtendedFamilyActive: false,
    isRaining: false,
    isTroutDerbyActive: false,
    isSquidFestActive: false,
    isUsingTrainingRod: false,
    isUsingTargetedBait: false,
  });
  const [averageGoldPerFish, setAverageGoldPerFish] = useState(0);
  const [jellyPrice, setJellyPrice] = useState(0);
  const [quality, setQuality] = useState(1);

  // update and pull Locations.xnb and Fish.xnb
  const [locationFishData, setLocationFishData] = useState([]);
  // update and pull Fish.xnb only
  const [appendedFishData, setAppendedFishData] = useState([]);
  // update and only use stored data
  const [filteredFishData, setFilteredFishData] = useState([]);
  const [fishDataWithChance, setFishDataWithChance] = useState([]);
  const fishNames = getFishNames()
  const locationAreas = getFishAreas()
  
  // util to access window width client side
  const [windowWidth, setWindowWidth] = useState(0);
  useEffect(() => {
    setWindowWidth(window.innerWidth)
  }, []);

  // makes sure the fish window height doesn't overflow the main window
  const fishDisplayWindow = useRef();
  const parametersWindow = useRef();
  const [maxHeight, setMaxHeight] = useState(null);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === parametersWindow.current && window.innerWidth >= 1024) {
          const newMaxHeight = parametersWindow.current.clientHeight;
          setMaxHeight(newMaxHeight);
        } else {
          setMaxHeight(null);
        }
      }
    });

    observer.observe(parametersWindow.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  // pull new fish data if relevant settings are changed
  useEffect(() => {
    setLocationFishData([])
    const updatedLocationFishData = getFishFromLocationAndSeason(selectedLocation, selectedSeason);
    setLocationFishData(updatedLocationFishData);
  }, [selectedLocation, selectedSeason]);

  // populate fish data with Fish.xnb if new location data is pulled
  useEffect(() => {
    let tempFishParamArray = []
    for (let i in locationFishData) {
      let fish = locationFishData[i]
      if (nonFishItems.includes(fish.Id) || fish.Id.includes("(F)")){
        switch(fish.Id){
          case "(O)821" : fish.displayname = "Fossilized Spine"; fish.sellPrice = 100; break;
          case "(O)825" : fish.displayname = "Snake Skull"; fish.sellPrice = 100; break;
          case "(O)797" : fish.displayname = "Pearl"; fish.sellPrice = 2500; break;
          case "(F)2332" : fish.displayname = "Gourmand Statue"; fish.sellPrice = 0; break;
          case "(F)2425" : fish.displayname = "Wall Basket"; fish.sellPrice = 0; break;
        }
        tempFishParamArray.push(fish);
        continue
      }
      if (!fish.Id || !fish.Id.match(/(\d+|Goby)/)) {
        if (fish.Id && fish.Id.match(/Jelly/)) {
          fish.name = fish.Id.substring(3, fish.Id.length-5)+" Jelly"
          fish.displayname = fish.name
          fish.weight = 0
          tempFishParamArray.push(fish);
        }
        continue
      }
      const newParams = getFishParameters(fish.Id.match(/(\d+|Goby)/)[0]);
      const mergedParams = {...fish, ...newParams};
      // name required as is for targeted bait, separate the parameters so displayname can be anything you want without interfering with targeted bait calculation
      mergedParams.displayname = mergedParams.name
      tempFishParamArray.push(mergedParams);
    }
    setAppendedFishData(tempFishParamArray);
  }, [locationFishData]);

  // filter fish data using parameters
  useEffect(() => {
    let tempFishParamArray = appendedFishData.slice()

    // filter sub area
    let correctSubArea = tempFishParamArray
      .filter((fish) =>
        selectedSubArea == null
        || (!fish.FishAreaId || fish.FishAreaId === selectedSubArea));
    tempFishParamArray = correctSubArea

    // filter bobber position
    let bobberDictionary = {
      "Waterfall": {"X": 51, "Y": 100, "Width": 15, "Height": 255},
      "SubmarinePier": {"X": 0, "Y": 32, "Width": 12, "Height": 255}
    }
    let filterBobber = tempFishParamArray
      .filter((fish) =>
        (!fish.BobberPosition)
        || _.isEqual(bobberDictionary[selectedBobberArea], fish.BobberPosition)
      )
    tempFishParamArray = filterBobber

    // filter player position for now, flex tape
    let noPlayerPosition = tempFishParamArray
      .filter((fish) =>
        fish.PlayerPosition === null
        || (fish.Condition && fish.Condition.includes("LEGENDARY_FAMILY")));
    tempFishParamArray = noPlayerPosition

    // also flex tape, filter PLAYER_HAS_MAIL for now
    let noPlayerMailCondition = tempFishParamArray
      .filter((fish) =>
        !fish.Condition || !fish.Condition.includes("PLAYER_HAS_MAIL"));
    tempFishParamArray = noPlayerMailCondition

    // filter extended family
    if (!checkedItems.isExtendedFamilyActive) {
      let noExtendedFamily = tempFishParamArray
        .filter((fish) => !fish.Condition || !fish.Condition.includes("LEGENDARY_FAMILY"));
      tempFishParamArray = noExtendedFamily
      };

    // filter training rod
    if (checkedItems.isUsingTrainingRod && selectedSeason != "MagicBait"){
      let setDifficultyCeiling = tempFishParamArray
        .filter((fish) => !fish.difficulty || fish.difficulty < 50);
      tempFishParamArray = setDifficultyCeiling
    }

    // filter fishing level requirements
    let fishingHighEnough = tempFishParamArray
      .filter((fish) => 
        (!fish.requiredLevel || fish.IgnoreFishDataRequirements || fish.requiredLevel <= fishingLevel)
        && (fish.MinFishingLevel <= fishingLevel ));
    tempFishParamArray = fishingHighEnough;

    // filter raining
    if (selectedSeason != "MagicBait") {
      if (checkedItems.isRaining) {
        let raining = tempFishParamArray
          .filter((fish) => !(fish.weather == "sunny") || fish.IgnoreFishDataRequirements);
        tempFishParamArray = raining
      } else {
        let sunny = tempFishParamArray
          .filter((fish) => !(fish.weather == "rainy") || fish.IgnoreFishDataRequirements);
        tempFishParamArray = sunny
      }
    }

    // filter shore distances
    let distance = tempFishParamArray.filter((fish) =>
      (fish.MaxDistanceFromShore <= -1 || waterDepth <= fish.MaxDistanceFromShore) 
      && (waterDepth >= fish.MinDistanceFromShore))
    tempFishParamArray = distance

    // trout derby
    // must be after raining and before time
    if (checkedItems.isTroutDerbyActive) {
      let rainbowTrout = appendedFishData.filter((fish) =>
        fish.Condition && fish.Condition.includes("TroutDerby"))
      if (rainbowTrout[0]) rainbowTrout[0].displayname = "Rainbow Trout (from event)"
      tempFishParamArray.concat(rainbowTrout)
    } else {
      let noTroutDerbyTrout = tempFishParamArray.filter((fish) => 
      !fish.Condition ||
      (fish.Condition && !fish.Condition.includes("TroutDerby")))
      tempFishParamArray = noTroutDerbyTrout
    }

    // squid fest
    if (checkedItems.isSquidFestActive) {
      let squid = appendedFishData.filter((fish) =>
        fish.Condition && fish.Condition.includes("SquidFest"))

      // squid time
      for (let i in squid) {
        let squidCondition = squid[i].Condition
        if (squidCondition.includes("TIME")) {
          let timeArray = squidCondition.split(" ")
          let timeIndex = timeArray.findIndex((e) => e == "TIME")
          let newTime = [timeArray[timeIndex + 1], timeArray[timeIndex + 2]]
          squid[i].time = newTime
          break;
        } else {
          squid[i].time = ["0600", "0600"]
        }
      }
      for (let i in squid) {
        if (squid[i]) squid[i].displayname = "Squid (from event)"
      }
      tempFishParamArray.concat(squid)
    } else {
      let noSquidFestSquid = tempFishParamArray.filter((fish) => 
      !fish.Condition ||
      (fish.Condition && !fish.Condition.includes("SquidFest")))
      tempFishParamArray = noSquidFestSquid
    }

    // filter times
    if (selectedSeason != "MagicBait") {
      let timeFilter = tempFishParamArray
      .filter((fish) =>
        (!fish.time || fish.IgnoreFishDataRequirements && (!fish.Condition || !fish.Condition.includes("TIME")))
        || 
        // single window fish
        (fish.time[0] <= timeOfDay &&  fish.time[1] > timeOfDay)
        ||
        // double window fish
        (fish.time.length == 4 &&
        fish.time[2] <= timeOfDay && fish.time[3] > timeOfDay))
      tempFishParamArray = timeFilter
    }

    setFilteredFishData(tempFishParamArray)
  }, [appendedFishData, selectedBobberArea, selectedSubArea, timeOfDay, checkedItems.isUsingTrainingRod, waterDepth, checkedItems.isExtendedFamilyActive, checkedItems.isRaining, checkedItems.isTroutDerbyActive, checkedItems.isSquidFestActive, fishingLevel])

  // calculate chances
  useEffect(() => {
    let tempFishParamArray = [];
    let tempTrashRate = 1

    for (let i in filteredFishData) {
      let fish = filteredFishData[i]
      if (fish.Id && !fish.Id.match(/Jelly/)) {
        fish["weight"] = calculateWeight(fish)
      }
    }

    // get jelly chance
    let jelly = filteredFishData.find((jelly) => jelly.Id && jelly.Id.match(/Jelly/));
    if (jellyMode === "longterm") {
      jelly && (jelly.weight = getJellyChance(filteredFishData, luckBuffs));
    } else if (jellyMode === "nextcatch") {
      jelly && (jelly.weight = jelly.Chance + jelly.ChanceBoostPerLuckLevel*luckBuffs);
    } else if (jellyMode === "goodseed") {
      jelly && (jelly.weight = 1);
    } else if (jellyMode === "badseed") {
      jelly && (jelly.weight = 0);
    }

    if (filteredFishData.length > 0) {
      // get chance
      if (checkedItems.isUsingTargetedBait && selectedSeason != "MagicBait") {
        let nonTargetedFish = filteredFishData.filter((fish) => !fish.name || fish.name != targetedBaitName)
        let targetedFish = filteredFishData.filter((fish) => fish.name && fish.name == targetedBaitName)
        let targetedBait = targetedBaitSingle(nonTargetedFish, targetedFish)
        tempTrashRate = targetedBait.caseAChance
        setTrashRate(tempTrashRate)

        for (let i in nonTargetedFish) {
          let fish = nonTargetedFish[i]
          fish.finalChance = rollFishPoolWithTargetedBait(targetedBait, nonTargetedFish, i)
          tempFishParamArray.push(fish);
        }
        
        if (targetedFish.length > 1){
          let fish = {
            Id: targetedFish[0].Id,
            displayname: targetedBaitName + " (multiple entries)",
            finalChance: targetedBait.caseCChance
          }
          tempFishParamArray.push(fish);
        } else {
          for (let i in targetedFish) {
            let fish = targetedFish[i]
            fish.finalChance = targetedBait.caseCChance
            tempFishParamArray.push(fish);
          }
        }
      } else {
        for (let i in filteredFishData) {
          let fish = filteredFishData[i]
          fish.finalChance = rollFishPool(filteredFishData, i)
          tempTrashRate -= fish.finalChance
          tempFishParamArray.push(fish);
        }
        setTrashRate(Math.max(0, tempTrashRate))
      }

      // handle OR fish (like submarine pier)
      let orFish = []
      for (let i in tempFishParamArray) {
        let fish = tempFishParamArray[i]
        if (fish.Id.includes("|")) {
          let orFishId = fish.Id.split("|")
          fish.finalChance /= orFishId.length
          for (let j in orFishId) {
            const newParams = getFishParameters(orFishId[j].match(/(\d+|Goby)/)[0]);
            const mergedParams = {...fish, ...newParams};
            mergedParams.Id = orFishId[j]
            mergedParams.displayname = mergedParams.name
            orFish.push(mergedParams);
          }
        } else {
          orFish.push(fish);
        }
      }
      tempFishParamArray = orFish

      // handle UndergroundMine
      if (selectedLocation == "UndergroundMine") {
        let caveJellyChance = 0
        let floorFishChance = 0
        if (!checkedItems.isUsingTrainingRod) {
          let chanceMultiplier = 1
          chanceMultiplier += 0.4 * fishingLevel
          chanceMultiplier += 0.1 * waterDepth
          chanceMultiplier += (checkedItems.isCuriosityLureActive) ? 5 : 0
          let mineFish = {
            Id: null,
            displayname: null,
            finalChance: 0
          } 
          switch (selectedMineArea) {
            case "20":
              chanceMultiplier += (checkedItems.isUsingTargetedBait && targetedBaitName=="Stonefish") ? 10 : 0
              console.log(fishingLevel, chanceMultiplier)
              floorFishChance = 0.02 + 0.01 * chanceMultiplier
              mineFish["Id"] = "(O)158"
              mineFish["displayname"] = "Stonefish"
              mineFish["finalChance"] = floorFishChance
              break;
            case "60":
              chanceMultiplier += (checkedItems.isUsingTargetedBait && targetedBaitName=="Ice Pip") ? 10 : 0
              floorFishChance = 0.015 + 0.009 * chanceMultiplier
              mineFish["Id"] = "(O)161"
              mineFish["displayname"] = "Ice Pip"
              mineFish["finalChance"] = floorFishChance
              break;
            case "100":
              chanceMultiplier += (checkedItems.isUsingTargetedBait && targetedBaitName=="Lava Eel") ? 10 : 0
              floorFishChance = 0.01 + 0.008 * chanceMultiplier
              mineFish["Id"] = "(O)162"
              mineFish["displayname"] = "Lava Eel"
              mineFish["finalChance"] = floorFishChance
              caveJellyChance = 0.05 + 0.05 * luckBuffs
              break;
          }
          if (selectedMineArea == "100") {
            let mineFishArray = []
            mineFishArray.push(mineFish)
            let caveJelly = {
              Id: "(O)CaveJelly",
              displayname: "Cave Jelly",
              finalChance: caveJellyChance * (1 - floorFishChance)
            }
            mineFishArray.push(caveJelly)
            tempFishParamArray = mineFishArray
            setTrashRate(1 - floorFishChance - caveJellyChance)
          } else {
            for (let i in tempFishParamArray) {
              tempFishParamArray[i]["finalChance"] *= (1 - floorFishChance)
            }
            tempFishParamArray.push(mineFish)
            setTrashRate(tempTrashRate * (1 - floorFishChance))
          }
        } else {
          tempFishParamArray = []
          setTrashRate(1)
        }
      }
        
      tempFishParamArray.sort((a, b) => b.finalChance-a.finalChance)
      setFishDataWithChance(tempFishParamArray);
    } else {
      setFishDataWithChance([])
    }

    function calculateWeight(fish) {
      let chanceFromFishData = 0;
      if (!fish.IgnoreFishDataRequirements && fish.baseRate) {
        chanceFromFishData = (fish.baseRate)
        chanceFromFishData *= (1 - Math.max(0, fish.maxDepth - waterDepth) * fish.depthMultiplier);
        chanceFromFishData += 0.02 * fishingLevel
        if (checkedItems.isUsingTrainingRod && selectedSeason != "MagicBait") {
          chanceFromFishData *= 1.1
        }
        chanceFromFishData = Math.min(chanceFromFishData, 0.9)
        if (checkedItems.isCuriosityLureActive && chanceFromFishData < 0.25) {
          if (fish.CuriosityLureBuff > -1) {
            chanceFromFishData += fish.CuriosityLureBuff
          } else {
            chanceFromFishData = (0.68 * chanceFromFishData + 0.085);
          }
        }
        if (targetedBaitName == fish.name && checkedItems.isUsingTargetedBait && selectedSeason != "MagicBait") {
          chanceFromFishData *= 1.66
        }
        if (fish.ApplyDailyLuck) {
          chanceFromFishData += dailyLuck
        }
      } else {
        chanceFromFishData = 1
      }

      let chanceFromLocationData = fish.Chance
      if (checkedItems.isCuriosityLureActive) {
        if (fish.CuriosityLureBuff > 0) {
          chanceFromLocationData += fish.CuriosityLureBuff
        }
      }
      if (targetedBaitName === fish.name && checkedItems.isUsingTargetedBait&& selectedSeason != "MagicBait") {
        chanceFromLocationData *= fish.SpecificBaitMultiplier
        chanceFromLocationData += fish.SpecificBaitBuff
      }
      if (fish.ApplyDailyLuck) {
        chanceFromLocationData += dailyLuck
      }

      chanceFromFishData = Math.min(1, Math.max(0, chanceFromFishData))
      chanceFromLocationData = Math.min(1, Math.max(0, chanceFromLocationData))
      return chanceFromFishData * chanceFromLocationData;
    }
  }, [filteredFishData, targetedBaitName, checkedItems.isUsingTargetedBait, checkedItems.isCuriosityLureActive, jellyMode, luckBuffs, selectedMineArea])

  // calculate average gold per fish for a location
  useEffect(() => {
    setJellyPrice(() => {
      for (let i = 0; i < locationFishData.length; i++) {
        if (locationFishData[i].Id == "(O)SeaJelly") return 200;
        if (locationFishData[i].Id == "(O)RiverJelly") return 125;
        if (locationFishData[i].Id == "(O)CaveJelly") return 180;
      }
    });
    let sumProduct = 0;
    for (let i = 0; i < filteredFishData.length; i++) {
      if (filteredFishData[i].sellPrice == undefined) {
        sumProduct += jellyPrice * filteredFishData[i].finalChance;
        continue;
      }
      sumProduct += filteredFishData[i].sellPrice * filteredFishData[i].finalChance * quality;
    }
    setAverageGoldPerFish(parseFloat(sumProduct).toFixed(2));
  }, [filteredFishData, locationFishData, jellyPrice, quality])

  const handleTimeChange = (value) => setTimeOfDay(value);
  const handleFishingLevelChange = (value) => setFishingLevel(value);
  const handleDepthChange = (value) => setWaterDepth(value);
  const handleJellyModeChange = (value) => setJellyMode(value);
  const handleTargetedBaitChange = (value) => setTargetedBaitName(value);
  const handleLuckBuffsChange = (value) => setLuckBuffs(value);
  const handleLocationChange = (value) => setSelectedLocation(value);
  const handleSubAreaChange = (value) => setSelectedSubArea(value);
  const handleBobberAreaChange = (value) => setSelectedBobberArea(value);
  const handleMineAreaChange = (value) => setSelectedMineArea(value);
  const handleSeasonChange = (value) => setSelectedSeason(value);
  const handleCheckboxChange = (event) => {
    const { id, checked } = event.target;
  
    const incompatibleCheckboxes = {
      "isUsingTargetedBait": ["isUsingTrainingRod"],
      "isUsingTrainingRod": ["isUsingTargetedBait", "isCuriosityLureActive"],
      "isCuriosityLureActive": ["isUsingTrainingRod"],
    }
  
    const incompatibleIds = incompatibleCheckboxes[id];
    if (incompatibleIds) {
      const updatedCheckedItems = { ...checkedItems };
      incompatibleIds.forEach(incompatibleId => {
        updatedCheckedItems[incompatibleId] = false;
      });
      updatedCheckedItems[id] = checked;
      setCheckedItems(updatedCheckedItems);
    } else {
      setCheckedItems({
        ...checkedItems,
        [id]: checked,
      });
    }
  };
  
  return (
    <Layout>
      <div className="items-center justify-center mt-16 mb-16 gap-6 grid md:grid-flow-row lg:grid-flow-col">

        <div ref={parametersWindow} className="bg-white p-8 rounded shadow-xl">
          <h1 className="lg:text-2xl text-xl font-bold mb-4 flex-wrap">Stardew Valley Fishing Calculator</h1>
          <p className="text-lg text-gray-700">Calculates how likely fish will bite!</p>

          <div className="grid grid-cols-1 2xl:grid-cols-2 2xl:gap-4">
            <div>
              <div className="flex justify-left my-4">
                <div className="shrink rounded-lg bg-green-200 text-green-700 p-2">
                  <p className="lg:text-lg md:text-base font-bold mb-2">Season</p>
                  <div className="columns-3 md:columns-5 space-y-2 gap-2">
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile018.png"
                      label="Spring"
                      deselectedColor="bg-white"
                      selectedColor="bg-green-300"
                      hoverColor="bg-green-100"
                      checked={selectedSeason === 'spring'}
                      onChange={() => handleSeasonChange('spring')}
                    />
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile402.png"
                      label="Summer"
                      deselectedColor="bg-white"
                      selectedColor="bg-green-300"
                      hoverColor="bg-green-100"
                      checked={selectedSeason === 'summer'}
                      onChange={() => handleSeasonChange('summer')}
                    />
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile408.png"
                      label="Fall"
                      deselectedColor="bg-white"
                      selectedColor="bg-green-300"
                      hoverColor="bg-green-100"
                      checked={selectedSeason === 'fall'}
                      onChange={() => handleSeasonChange('fall')}
                    />
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile416.png"
                      label="Winter"
                      deselectedColor="bg-white"
                      selectedColor="bg-green-300"
                      hoverColor="bg-green-100"
                      checked={selectedSeason === 'winter'}
                      onChange={() => handleSeasonChange('winter')}
                    />
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile908.png"
                      label="Magic Bait"
                      deselectedColor="bg-white"
                      selectedColor="bg-green-300"
                      hoverColor="bg-green-100"
                      checked={selectedSeason === 'MagicBait'}
                      onChange={() => handleSeasonChange('MagicBait')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-left my-4">
                <div className="shrink rounded-lg bg-blue-200 text-blue-700 p-2">
                  <p className="lg:text-lg md:text-base font-bold mb-2">Fishing Location</p>
                  <div className="columns-3 md:columns-5 space-y-2 gap-2">
                    <div className="break-inside-avoid">
                      <BranchingOptions
                        customIcon="/stardew-fishing-calc/assets/tiles/tile372.png"
                        label="Beach"
                        deselectedColor="bg-white"
                        selectedColor="bg-blue-300"
                        checked={selectedLocation === 'Beach'}
                        onChange={() => {
                          handleLocationChange('Beach')
                          handleSubAreaChange('')
                          handleBobberAreaChange('')
                          handleMineAreaChange('')
                        }}
                      >
                        <ChildrenOptions
                          label="Default"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedLocation === 'Beach' && selectedSubArea == '' && selectedBobberArea == ''}
                          onChange={() => {
                            handleLocationChange('Beach')
                            handleSubAreaChange('')
                            handleBobberAreaChange('')
                            handleMineAreaChange('')
                          }}
                        />
                        <Tooltip
                          direction={(windowWidth >= 640) ? "right" : "top"}
                          hoverArea={
                            <ChildrenOptions
                              label="West Pier"
                              deselectedColor="bg-white"
                              selectedColor="bg-blue-300"
                              checked={selectedBobberArea === 'SubmarinePier'}
                              onChange={() => {
                                handleLocationChange('Beach')
                                handleSubAreaChange('')
                                handleBobberAreaChange('SubmarinePier')
                                handleMineAreaChange('')
                              }}
                            />
                          }
                          tooltip={<p className="text-sm w-40 text-wrap">Fishing with magic bait on the westernmost pier where the submarine would be at the night market.</p>}
                        />
                      </BranchingOptions>
                    </div>
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile117.png"
                      label="Submarine"
                      deselectedColor="bg-white"
                      selectedColor="bg-blue-300"
                      checked={selectedLocation === 'Submarine'}
                      onChange={() => {
                        handleLocationChange('Submarine')
                        handleSubAreaChange('')
                        handleBobberAreaChange('')
                        handleMineAreaChange('')
                      }}
                    />
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile032.png"
                      label="Mountain Lake"
                      deselectedColor="bg-white"
                      selectedColor="bg-blue-300"
                      checked={selectedLocation === 'Mountain'}
                      onChange={() => {
                        handleLocationChange('Mountain')
                        handleSubAreaChange('')
                        handleBobberAreaChange('')
                        handleMineAreaChange('')
                      }}
                    />
                    <div className="break-inside-avoid">
                      <BranchingOptions
                        customIcon="/stardew-fishing-calc/assets/tiles/tilePickaxe.png"
                        label="Mines"
                        deselectedColor="bg-white"
                        selectedColor="bg-blue-300"
                        checked={selectedLocation === 'UndergroundMine'}
                        onChange={() => {
                          handleLocationChange('UndergroundMine')
                          handleSubAreaChange('')
                          handleBobberAreaChange('')
                          handleMineAreaChange('20')
                        }}
                      >
                        <ChildrenOptions
                          label="Floor 20"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedMineArea === '20'}
                          onChange={() => {
                            handleLocationChange('UndergroundMine')
                            handleSubAreaChange('')
                            handleBobberAreaChange('')
                            handleMineAreaChange('20')
                          }}
                        />
                        <ChildrenOptions
                          label="Floor 60"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedMineArea === '60'}
                          onChange={() => {
                            handleLocationChange('UndergroundMine')
                            handleSubAreaChange('')
                            handleBobberAreaChange('')
                            handleMineAreaChange('60')
                          }}
                        />
                        <ChildrenOptions
                          label="Floor 100"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedMineArea === '100'}
                          onChange={() => {
                            handleLocationChange('UndergroundMine')
                            handleSubAreaChange('')
                            handleBobberAreaChange('')
                            handleMineAreaChange('100')
                          }}
                        />
                      </BranchingOptions>
                    </div>
                    <div className="break-inside-avoid">
                      <BranchingOptions
                        customIcon="/stardew-fishing-calc/assets/tiles/tile311.png"
                        label="Cindersap Forest"
                        deselectedColor="bg-white"
                        selectedColor="bg-blue-300"
                        checked={selectedLocation === 'Forest'}
                        onChange={() => {
                          handleSubAreaChange('River')
                          handleBobberAreaChange('')
                          handleLocationChange('Forest')
                          handleMineAreaChange('')
                        }}
                      >
                        <ChildrenOptions
                          label="River"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedSubArea === 'River' && selectedBobberArea !== "Waterfall"}
                          onChange={() => {
                            handleLocationChange('Forest')
                            handleSubAreaChange('River')
                            handleBobberAreaChange('')
                            handleMineAreaChange('')
                          }}
                        />
                        <ChildrenOptions
                          label="Pond"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedSubArea === 'Lake'}
                          onChange={() => {
                            handleLocationChange('Forest')
                            handleSubAreaChange('Lake')
                            handleBobberAreaChange('')
                            handleMineAreaChange('')
                          }}
                        />
                        <ChildrenOptions
                          label="Waterfall"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedBobberArea === 'Waterfall'}
                          onChange={() => {
                            handleLocationChange('Forest')
                            handleSubAreaChange('River')
                            handleBobberAreaChange('Waterfall')
                            handleMineAreaChange('')
                          }}
                        />
                      </BranchingOptions>
                    </div>
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile709.png"
                      label="Secret Woods"
                      deselectedColor="bg-white"
                      selectedColor="bg-blue-300"
                      checked={selectedLocation === 'Woods'}
                      onChange={() => {
                      handleLocationChange('Woods')
                      handleSubAreaChange('')
                      handleBobberAreaChange('')
                      handleMineAreaChange('')
                    }}
                    />
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile325.png"
                      label="Pelican Town"
                      deselectedColor="bg-white"
                      selectedColor="bg-blue-300"
                      checked={selectedLocation === 'Town'}
                      onChange={() => {
                        handleLocationChange('Town')
                        handleSubAreaChange('')
                        handleBobberAreaChange('')
                        handleMineAreaChange('')
                      }}
                    />
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile090.png"
                      label="Desert"
                      deselectedColor="bg-white"
                      selectedColor="bg-blue-300"
                      checked={selectedLocation === 'Desert'}
                      onChange={() => {
                        handleLocationChange('Desert')
                        handleSubAreaChange('TopPond')
                        handleBobberAreaChange('')
                        handleMineAreaChange('')
                      }}
                    />
                    <RadioOptions
                      customIcon="/stardew-fishing-calc/assets/tiles/tile308.png"
                      label="Witch Swamp"
                      deselectedColor="bg-white"
                      selectedColor="bg-blue-300"
                      checked={selectedLocation === 'WitchSwamp'}
                      onChange={() => {
                        handleLocationChange('WitchSwamp')
                        handleSubAreaChange('')
                        handleBobberAreaChange('')
                        handleMineAreaChange('')
                      }}
                    />
                    <div className="break-inside-avoid">
                      <BranchingOptions
                        customIcon="/stardew-fishing-calc/assets/tiles/tile829.png"
                        label="Ginger Island"
                        deselectedColor="bg-white"
                        selectedColor="bg-blue-300"
                        checked={['IslandNorth', 'IslandWest', 'IslandSouth', "IslandSouthEastCave"].includes(selectedLocation)}
                        onChange={() => {
                          handleLocationChange('IslandNorth')
                          handleSubAreaChange('')
                          handleBobberAreaChange('')
                          handleMineAreaChange('')
                        }}
                      >
                        <ChildrenOptions
                          label="North"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedLocation === 'IslandNorth'}
                          onChange={() => {
                            handleLocationChange('IslandNorth')
                            handleSubAreaChange('')
                            handleBobberAreaChange('')
                            handleMineAreaChange('')
                          }}
                        />
                        <ChildrenOptions
                          label="West (River)"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedLocation === 'IslandWest' && selectedSubArea === 'Freshwater'}
                          onChange={() => {
                            handleLocationChange('IslandWest')
                            handleSubAreaChange('Freshwater')
                            handleBobberAreaChange('')
                            handleMineAreaChange('')
                          }}
                        />
                        <ChildrenOptions
                          label="West (Ocean)"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedLocation === 'IslandWest' && selectedSubArea === 'Ocean'}
                          onChange={() => {
                            handleLocationChange('IslandWest')
                            handleSubAreaChange('Ocean')
                            handleBobberAreaChange('')
                            handleMineAreaChange('')
                          }}
                        />
                        <ChildrenOptions
                          label="South"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedLocation === 'IslandSouth'}
                          onChange={() => {
                            handleLocationChange('IslandSouth')
                            handleSubAreaChange('')
                            handleBobberAreaChange('')
                            handleMineAreaChange('')
                          }}
                        />
                        <ChildrenOptions
                          label="Pirate Cove"
                          deselectedColor="bg-white"
                          selectedColor="bg-blue-300"
                          checked={selectedLocation === 'IslandSouthEastCave'}
                          onChange={() => {
                            handleLocationChange('IslandSouthEastCave')
                            handleSubAreaChange('')
                            handleBobberAreaChange('')
                            handleMineAreaChange('')
                          }}
                        />
                      </BranchingOptions>
                    </div>
                  </div>
                </div>
              </div>

              <div className='mt-4 rounded-lg border-2 p-2 2xl:mb-4'>
                <TimeSlider
                  title="Fishing Time:"
                  value={timeOfDay}
                  disabled={(selectedSeason == 'MagicBait') ? true : false}
                  onChange={handleTimeChange} 
                />
              </div>
            </div>
            <div>
              <div className='my-4 rounded-lg border-2 p-2'>
                <p className="text-base font-bold mb-2">Fish Type Modifiers</p>
                <div className="grid sm:grid-cols-1 md:grid-cols-2 mb-2 md:gap-8">
                  <div>
                    <Checkbox
                      label="Raining"
                      checked={checkedItems.isRaining}
                      disabled={(selectedSeason == 'MagicBait') ? true : false}
                      onChange={handleCheckboxChange}
                      id="isRaining"
                    />
                    <Checkbox
                      label="Using training rod"
                      checked={(selectedSeason == 'MagicBait') ? false : checkedItems.isUsingTrainingRod}
                      disabled={(selectedSeason == 'MagicBait') ? true : false}
                      onChange={handleCheckboxChange}
                      id="isUsingTrainingRod"
                    />
                  </div>
                  <div>
                    <Tooltip
                      direction="top"
                      hoverArea={
                        <Checkbox
                          label="Extended family quest"
                          onChange={handleCheckboxChange}
                          id="isExtendedFamilyActive"
                        />
                      }
                      tooltip={<p className="text-sm w-40 text-wrap">Only assuming you fish at the correct area.</p>}
                    />
                    <Checkbox
                      label="Trout derby active"
                      onChange={handleCheckboxChange}
                      id="isTroutDerbyActive"
                    />
                    <Checkbox
                      label="Squid fest active"
                      onChange={handleCheckboxChange}
                      id="isSquidFestActive"
                    />
                  </div>
                </div>
              </div>

              <div className='my-4 rounded-lg border-2 px-2 pt-2'>
                <p className="text-base font-bold mb-2">Chance Modifiers</p>
                <div>
                  <div className="grid sm:grid-cols-1 md:grid-cols-2 mb-2 md:gap-8">
                    <div>
                      <GenericSlider
                        title="Fishing Level:"
                        min={0}
                        max={19}
                        value={fishingLevel}
                        onChange={handleFishingLevelChange} 
                      />
                      <Tooltip
                        direction="top"
                        hoverArea={
                          <GenericSlider
                            title="Luck Buff Level:"
                            min={0}
                            max={13}
                            value={luckBuffs}
                            onChange={handleLuckBuffsChange} 
                          />
                        }
                        tooltip={<p className="text-sm w-40 text-wrap">Total number of luck buffs from food, drinks, etc</p>}
                      />
                      
                      <GenericSlider
                        title="Water Depth:"
                        min={0}
                        max={5}
                        value={waterDepth}
                        onChange={handleDepthChange} 
                      />
                    </div>
                    <div>
                      <Checkbox
                        label="Using curiosity lure"
                        checked={checkedItems.isCuriosityLureActive}
                        onChange={handleCheckboxChange}
                        id="isCuriosityLureActive"
                      /> 
                      <TargetedContainer
                        options={fishNames}
                        onSelect={handleTargetedBaitChange}
                        disabled={(selectedSeason == 'MagicBait') ? true : !checkedItems.isUsingTargetedBait}
                      >
                        <Checkbox
                          label="Using targeted bait:"
                          checked={(selectedSeason == 'MagicBait') ? false : checkedItems.isUsingTargetedBait}
                          disabled={(selectedSeason == 'MagicBait') ? true : false}
                          onChange={handleCheckboxChange}
                          id="isUsingTargetedBait"
                        /> 
                      </TargetedContainer>
                    </div>
                  </div>
                  <div>
                    
                  </div>
                </div>
              </div>

              <div className='my-4'>
                <div className="shrink rounded-lg bg-purple-200 text-purple-700 p-2">
                  <p className="lg:text-lg md:text-base font-bold mb-2">Quality</p>
                  <div className="columns-3 md:columns-5 space-y-2 gap-2">
                    <RadioOptions
                      label="Common"
                      deselectedColor="bg-white"
                      selectedColor="bg-blue-300"
                      hoverColor="bg-blue-100"
                      checked={quality === 1}
                      onChange={() => setQuality(() => { return 1; })}
                    />

                    <RadioOptions
                      label="Silver"
                      deselectedColor="bg-white"
                      selectedColor="bg-gray-300"
                      hoverColor="bg-gray-100"
                      checked={quality === 1.25}
                      onChange={() => setQuality(() => { return 1.25; })}
                    />

                    <RadioOptions
                      label="Gold"
                      deselectedColor="bg-white"
                      selectedColor="bg-yellow-300"
                      hoverColor="bg-yellow-100"
                      checked={quality === 1.5}
                      onChange={() => setQuality(() => { return 1.5; })}
                    />

                    <RadioOptions
                      label="Iridium"
                      deselectedColor="bg-white"
                      selectedColor="bg-purple-300"
                      hoverColor="bg-purple-100"
                      checked={quality === 2}
                      onChange={() => setQuality(() => { return 2; })}
                    />
                  </div>
                </div>
                <br></br>

                <Accordion
                  title="Advanced Options"
                >
                  <div className="rounded-lg p-2">
                    <div className="flex flex-row gap-2">
                      <p className="text-base text-gray-800 font-semibold mb-2">Jelly Calculation Mode:</p>
                      <Tooltip
                        img="/stardew-fishing-calc/assets/bubble2.gif"
                        direction="top"
                        tooltip={
                          <div className="text-sm w-72 md:w-96 text-wrap p-1">
                            <p className="font-semibold">Jelly chance is a bit tricky.</p>
                            <p>Whether you catch it or not depends on a seed. That seed depends on the number of fish you caught (excluding trash and algae). So we&apos;ve included several options:</p>
                            <ul className="mt-4 list-decimal list-inside space-y-2">
                              <li><span className="font-semibold">Long-term (default):</span> The expected chance to catch jelly if you&apos;re fishing in the same location for a long time.</li>
                              <li><span className="font-semibold">Next catch:</span> The immediate chance to catch jelly given a random state. Your chance decreases when you catch trash.</li>
                              <li><span className="font-semibold">Good seed:</span> If you have the correct seed, the chance for jelly becomes 1. There&apos;s still other fish to account for, though.</li>
                              <li><span className="font-semibold">Bad seed:</span> If you have the wrong seed, the chance for jelly becomes 0.</li>
                            </ul>
                          </div>
                        }
                      />
                    </div>
                    <div className="flex gap-4 items-center flex-wrap">
                      <SmallOptions
                        label="Long-term"
                        deselectedColor="bg-gray-300"
                        selectedColor="bg-white"
                        checked={jellyMode === 'longterm'}
                        onChange={() => handleJellyModeChange('longterm')}
                      />
                      <SmallOptions
                        label="Next catch"
                        deselectedColor="bg-gray-300"
                        selectedColor="bg-white"
                        checked={jellyMode === 'nextcatch'}
                        onChange={() => handleJellyModeChange('nextcatch')}
                      />
                      <SmallOptions
                        label="Good seed"
                        deselectedColor="bg-gray-300"
                        selectedColor="bg-white"
                        checked={jellyMode === 'goodseed'}
                        onChange={() => handleJellyModeChange('goodseed')}
                      />
                      <SmallOptions
                        label="Bad seed"
                        deselectedColor="bg-gray-300"
                        selectedColor="bg-white"
                        checked={jellyMode === 'badseed'}
                        onChange={() => handleJellyModeChange('badseed')}
                      />
                    </div>
                  </div>
                </Accordion>
              </div>
            </div>
          </div>
        </div>
        
        <div ref={fishDisplayWindow} style={{ maxHeight }} className="flex flex-col bg-white rounded shadow-xl lg:w-80 lg:h-full lg:overflow-y-auto">
          <div className="sticky top-0 bg-gray-200 text-gray-600 p-4">
              <h3 className="text-xl font-bold">You will catch...</h3>
              <h4>{averageGoldPerFish} Gold per Fish</h4>
          </div>
          <div className="flex flex-grow flex-col bg-white py-4">
            {fishDataWithChance.map((fish, index) => {
              const iconNumber = (fish.Id) ? fish.Id.substring(3) : null;
              const iconPath = `/stardew-fishing-calc/assets/tiles/tile${iconNumber}.png`;

              return (
                <FishCard
                  key={index}
                  name={fish.displayname}
                  chance={parseFloat(fish.finalChance*100).toFixed(2)+"%"}
                  // chance={Math.round(fish.finalChance*10000)/10000}
                  icon={iconPath}
                  sellPrice={fish.sellPrice == undefined ? jellyPrice : fish.sellPrice * quality}
                />
              );
            })}
            <FishCard
                key={fishDataWithChance.length}
                name="Trash"
                chance={parseFloat(trashRate*100).toFixed(2)+"%"}
                icon={`/stardew-fishing-calc/assets/tiles/tile168.png`}
                sellPrice={0}
              />
          </div>
        </div>

        {/* <div className="h-full bg-white p-8 rounded shadow-xl w-40">
            <p>{JSON.stringify(getFishAreas())}</p>
            <p>{JSON.stringify(fishDataWithChance)}</p>
        </div> */}

      </div>
    </Layout>
  );
}